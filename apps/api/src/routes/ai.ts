import { type LLM, createLLM } from '@bloc/ai';
import {
  type ClientHandle,
  getPage,
  listProperties,
  recordAIRun,
  requirePermission,
  resolveLevel,
  schema,
  setPageProperty,
} from '@bloc/db';
import { withSpan } from '@bloc/observability';
import {
  BlocNotFoundError,
  BlocRestrictedError,
  BlocValidationError,
  PROPERTY_VALUE_PAYLOADS,
  type PropertyType,
  isPropertyType,
  isReadonlyPropertyType,
} from '@bloc/shared';
import { and, eq, ilike, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import '../types.ts';
import { runAgent } from '../ai/agent.ts';

interface Deps {
  handle: ClientHandle;
  /** Optional LLM injection for tests; defaults to env-configured provider. */
  llm?: LLM;
}

const CompletionsSchema = z
  .object({
    surface: z.enum(['writer', 'ai_block', 'agent', 'autofill', 'qa']).default('writer'),
    model: z.enum(['default', 'fast', 'advanced']).default('default'),
    messages: z
      .array(
        z.object({
          role: z.enum(['system', 'user', 'assistant', 'tool']),
          content: z.string().max(200_000),
          name: z.string().optional(),
        }),
      )
      .min(1)
      .max(50),
    context_pages: z.array(z.string().uuid()).max(20).optional(),
    block_id: z.string().uuid().optional(),
  })
  .strict();

const QASchema = z
  .object({
    query: z.string().min(1).max(2000),
    filter: z
      .object({
        object: z.enum(['page', 'database']).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const AutofillSchema = z
  .object({
    page_id: z.string().uuid(),
    property_id: z.string().uuid(),
    /** Optional context (additional prompt). */
    instructions: z.string().max(2000).optional(),
  })
  .strict();

export function createAIRouter(deps: Deps): Hono {
  const router = new Hono();
  const llm = deps.llm ?? createLLM();

  // POST /v1/ai/completions — synchronous JSON completion. Streaming (SSE) ships in v1.1.
  router.post('/completions', async (c) => {
    const actor = c.get('actor');
    const body = CompletionsSchema.parse(await c.req.json());
    return withSpan(
      'ai',
      `ai.${body.surface}`,
      { 'ai.model': body.model, 'ai.surface': body.surface },
      async () => {
        // Permission-filter context_pages.
        const context: Array<{ pageId: string; snippet: string }> = [];
        if (body.context_pages !== undefined && body.context_pages.length > 0) {
          for (const pageId of body.context_pages) {
            const level = await resolveLevel(deps.handle.db, actor, { type: 'page', id: pageId });
            if (level === 'no_access') continue;
            const page = await getPage(deps.handle.db, pageId);
            if (page === null) continue;
            const props = await listProperties(deps.handle.db, page.parentId ?? '');
            const snippet = props
              .map((p) => p.name)
              .join(', ')
              .slice(0, 200);
            context.push({ pageId, snippet });
          }
        }
        const result = await llm.chat({
          model: body.model,
          messages: body.messages,
          context,
        });
        if (body.surface === 'ai_block' && body.block_id !== undefined) {
          const { getBlock, updateBlock } = await import('@bloc/db');
          const block = await getBlock(deps.handle.db, body.block_id);
          if (block === null) {
            throw new BlocNotFoundError(`Block ${body.block_id} not found`, c.get('requestId'));
          }
          if (block.type !== 'ai_block') {
            throw new BlocValidationError(
              `Block ${body.block_id} is not an ai_block (type=${block.type})`,
              c.get('requestId'),
            );
          }
          // Walk up to the page ancestor for the ACL check.
          let cursor = block;
          let safety = 0;
          while (cursor.parentType === 'block' && safety < 50) {
            const parent = await getBlock(deps.handle.db, cursor.parentId);
            if (parent === null) break;
            cursor = parent;
            safety += 1;
          }
          if (cursor.parentType !== 'page') {
            throw new BlocNotFoundError(
              `Block ${body.block_id} has no resolvable page ancestor`,
              c.get('requestId'),
            );
          }
          const pageId = cursor.parentId;
          await requirePermission(deps.handle.db, actor, { type: 'page', id: pageId }, 'can_edit');
          const existing = (block.content as Record<string, unknown>)['ai_block'] as
            | Record<string, unknown>
            | undefined;
          const nextContent = {
            ai_block: {
              ...(existing ?? {}),
              prompt: existing?.['prompt'] ?? [],
              output: [
                {
                  type: 'text',
                  text: { content: result.text, link: null },
                  annotations: {},
                  plain_text: result.text,
                  href: null,
                },
              ],
              model: body.model,
              last_run_at: new Date().toISOString(),
            },
          };
          await updateBlock(deps.handle.db, body.block_id, {
            content: nextContent,
            actor: actor.userId,
          });
        }
        await recordAIRun(deps.handle.db, {
          workspaceId: actor.workspaceId,
          userId: actor.userId,
          surface: body.surface,
          model: body.model,
          prompt: body.messages.map((m) => m.content).join('\n'),
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          latencyMs: result.latencyMs,
        });
        return c.json({
          object: 'ai_completion',
          surface: body.surface,
          model: body.model,
          text: result.text,
          tokens_in: result.tokensIn,
          tokens_out: result.tokensOut,
          citations: result.citations ?? [],
        });
      },
    );
  });

  // POST /v1/ai/qa — workspace-scoped retrieval + completion with ACL filter.
  router.post('/qa', async (c) => {
    const actor = c.get('actor');
    const body = QASchema.parse(await c.req.json());
    return withSpan('ai', 'ai.qa', { 'qa.query_length': body.query.length }, async () => {
      // Naive retrieval: substring match in titles + first-block content.
      const pattern = `%${body.query}%`;
      const pageRows = await deps.handle.db
        .select()
        .from(schema.pages)
        .where(
          and(eq(schema.pages.workspaceId, actor.workspaceId), eq(schema.pages.archived, false)),
        )
        .limit(50);
      const visibleHits: Array<{ pageId: string; snippet: string; score: number }> = [];
      for (const row of pageRows) {
        const level = await resolveLevel(deps.handle.db, actor, { type: 'page', id: row.id });
        if (level === 'no_access') continue;
        const [match] = await deps.handle.db
          .select()
          .from(schema.blocks)
          .where(
            and(
              eq(schema.blocks.parentId, row.id),
              ilike(sql`${schema.blocks.content}::text`, pattern),
            ),
          )
          .limit(1);
        if (match !== undefined) {
          const text = JSON.stringify(match.content).slice(0, 200);
          visibleHits.push({ pageId: row.id, snippet: text, score: 0.8 });
        }
      }

      const completion = await llm.chat({
        model: 'default',
        messages: [
          { role: 'system', content: 'You answer questions using the provided context.' },
          { role: 'user', content: body.query },
        ],
        context: visibleHits,
      });

      await recordAIRun(deps.handle.db, {
        workspaceId: actor.workspaceId,
        userId: actor.userId,
        surface: 'qa',
        model: 'default',
        prompt: body.query,
        tokensIn: completion.tokensIn,
        tokensOut: completion.tokensOut,
        latencyMs: completion.latencyMs,
      });

      return c.json({
        object: 'ai_answer',
        answer: completion.text,
        sources: visibleHits.map((h) => ({
          page_id: h.pageId,
          snippet: h.snippet,
          score: h.score,
        })),
      });
    });
  });

  // POST /v1/ai/autofill/run
  router.post('/autofill/run', async (c) => {
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const body = AutofillSchema.parse(await c.req.json());
    return withSpan(
      'ai',
      'ai.autofill',
      { 'page.id': body.page_id, 'property.id': body.property_id },
      async () => {
        const page = await getPage(deps.handle.db, body.page_id);
        if (page === null)
          throw new BlocNotFoundError(`Page ${body.page_id} not found`, requestId);
        if (page.parentType !== 'database' || page.parentId === null) {
          throw new BlocValidationError('Autofill requires a database-row page', requestId);
        }
        await requirePermission(
          deps.handle.db,
          actor,
          { type: 'page', id: body.page_id },
          'can_edit',
        );
        const props = await listProperties(deps.handle.db, page.parentId);
        const def = props.find((p) => p.id === body.property_id);
        if (def === undefined) {
          throw new BlocNotFoundError(`Property ${body.property_id} not found`, requestId);
        }
        if (!isPropertyType(def.type)) {
          throw new BlocRestrictedError(`Autofill not supported for type ${def.type}`, requestId);
        }
        if (isReadonlyPropertyType(def.type as PropertyType)) {
          throw new BlocRestrictedError(
            `Autofill cannot set read-only property type ${def.type}`,
            requestId,
          );
        }

        const completion = await llm.chat({
          model: 'fast',
          messages: [
            {
              role: 'system',
              content: `Auto-fill the property '${def.name}' (type: ${def.type}).`,
            },
            { role: 'user', content: body.instructions ?? 'Generate a sensible value.' },
          ],
        });

        // Construct a type-appropriate value envelope from the completion text.
        const value = buildValueEnvelope(def.type, completion.text);
        const schemaForType = PROPERTY_VALUE_PAYLOADS[def.type as PropertyType];
        const parsed = schemaForType.safeParse(value);
        if (!parsed.success) {
          throw new BlocValidationError(
            `Autofill produced an invalid value for ${def.type}`,
            requestId,
          );
        }
        await setPageProperty(deps.handle.db, {
          pageId: body.page_id,
          propertyId: body.property_id,
          value: { type: def.type, ...(parsed.data as Record<string, unknown>) },
        });

        await recordAIRun(deps.handle.db, {
          workspaceId: actor.workspaceId,
          userId: actor.userId,
          surface: 'autofill',
          model: 'fast',
          prompt: body.instructions ?? 'autofill',
          tokensIn: completion.tokensIn,
          tokensOut: completion.tokensOut,
          latencyMs: completion.latencyMs,
        });

        return c.json({
          object: 'property_item',
          id: def.id,
          type: def.type,
          [def.type]: (parsed.data as Record<string, unknown>)[def.type],
        });
      },
    );
  });

  // POST /v1/ai/agent — bounded tool-call loop.
  router.post('/agent', async (c) => {
    const actor = c.get('actor');
    const body = z
      .object({
        goal: z.string().min(1).max(2000),
        max_iterations: z.number().int().min(1).max(10).default(5),
        context_pages: z.array(z.string().uuid()).max(20).optional(),
      })
      .strict()
      .parse(await c.req.json());

    return withSpan(
      'ai',
      'ai.agent.task',
      { 'goal.length': body.goal.length, 'max.iterations': body.max_iterations },
      async () => {
        const result = await runAgent({
          handle: deps.handle,
          actor,
          llm,
          goal: body.goal,
          maxIterations: body.max_iterations,
          ...(body.context_pages !== undefined ? { contextPages: body.context_pages } : {}),
        });
        await recordAIRun(deps.handle.db, {
          workspaceId: actor.workspaceId,
          userId: actor.userId,
          surface: 'agent',
          model: 'default',
          prompt: body.goal,
          tokensIn: 0,
          tokensOut: 0,
          latencyMs: 0,
        });
        return c.json({ object: 'agent_run', ...result });
      },
    );
  });

  return router;
}

/** Map a free-form completion to a type-specific value envelope payload. */
function buildValueEnvelope(type: string, text: string): Record<string, unknown> {
  const trimmed = text.trim().slice(0, 2000);
  switch (type) {
    case 'title':
      return { title: [{ type: 'text', text: { content: trimmed, link: null } }] };
    case 'rich_text':
      return { rich_text: [{ type: 'text', text: { content: trimmed, link: null } }] };
    case 'number': {
      const n = Number(trimmed.match(/-?\d+(\.\d+)?/)?.[0] ?? 0);
      return { number: Number.isFinite(n) ? n : 0 };
    }
    case 'checkbox':
      return { checkbox: /^(true|yes|done|on|1)$/i.test(trimmed) };
    case 'url':
      return { url: /^https?:\/\//.test(trimmed) ? trimmed : 'https://example.com' };
    case 'email':
      return { email: /[\w.+-]+@[\w-]+\.[\w.-]+/.test(trimmed) ? trimmed : 'noreply@example.com' };
    case 'phone_number':
      return { phone_number: trimmed };
    case 'date':
      return { date: { start: new Date().toISOString().slice(0, 10), end: null, time_zone: null } };
    case 'select':
      return { select: { name: trimmed.slice(0, 80) } };
    case 'multi_select':
      return { multi_select: [{ name: trimmed.slice(0, 80) }] };
    case 'status':
      return { status: { name: trimmed.slice(0, 80) } };
    case 'people':
      return { people: [] };
    case 'files':
      return { files: [] };
    case 'relation':
      return { relation: [] };
    default:
      return {};
  }
}
