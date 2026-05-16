import type { LLM } from '@bloc/ai';
import type { Actor, ClientHandle } from '@bloc/db';
import { appendChildren, createPage, getPage, listProperties, schema } from '@bloc/db';
import { createLogger } from '@bloc/observability';
import { and, eq, ilike, inArray, sql } from 'drizzle-orm';

const logger = createLogger('ai.agent');

export interface AgentStep {
  index: number;
  type: 'tool_call' | 'llm';
  tool?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  message?: string;
  status: 'success' | 'failed';
  duration_ms: number;
}

export interface AgentResult {
  task_id: string;
  status: 'success' | 'partial' | 'failed';
  goal: string;
  steps: AgentStep[];
  /** Final assistant message after the loop terminated. */
  message: string;
}

export interface AgentRunArgs {
  handle: ClientHandle;
  actor: Actor;
  llm: LLM;
  goal: string;
  /** Hard cap on iterations to bound work. */
  maxIterations?: number;
  /** Optional context page-ids to feed the LLM each iteration. */
  contextPages?: string[];
}

/**
 * v1 agent loop: read the goal, pick a tool, run it, feed the result into the
 * next LLM prompt. Stops when the LLM says it's done or maxIterations is hit.
 */
export async function runAgent(args: AgentRunArgs): Promise<AgentResult> {
  const max = args.maxIterations ?? 5;
  const steps: AgentStep[] = [];
  const taskId = crypto.randomUUID();
  let status: AgentResult['status'] = 'success';
  let finalMessage = '';
  const history: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string }> = [
    {
      role: 'system',
      content:
        'You are an agent inside a Bloc workspace. Pick a single tool per turn from the registry: search(query), get_page(id), create_page(parent_page_id, title), append_block(parent_id, type, text). Respond with "TOOL: <name> <json args>" or "DONE: <answer>" on the final turn.',
    },
    { role: 'user', content: args.goal },
  ];

  for (let i = 0; i < max; i++) {
    const tStart = performance.now();
    const completion = await args.llm.chat({
      model: 'default',
      messages: history,
      ...(args.contextPages !== undefined && args.contextPages.length > 0
        ? { context: args.contextPages.map((id) => ({ pageId: id, snippet: '' })) }
        : {}),
    });
    history.push({ role: 'assistant', content: completion.text });
    const decision = parseDecision(completion.text);
    if (decision === null) {
      // LLM didn't pick a tool; record an llm step and exit.
      steps.push({
        index: i,
        type: 'llm',
        message: completion.text,
        status: 'success',
        duration_ms: Math.round(performance.now() - tStart),
      });
      finalMessage = completion.text;
      break;
    }
    if (decision.kind === 'done') {
      steps.push({
        index: i,
        type: 'llm',
        message: decision.message,
        status: 'success',
        duration_ms: Math.round(performance.now() - tStart),
      });
      finalMessage = decision.message;
      break;
    }
    // Tool call.
    const tToolStart = performance.now();
    try {
      const output = await invokeTool(args, decision.tool, decision.args);
      steps.push({
        index: i,
        type: 'tool_call',
        tool: decision.tool,
        input: decision.args,
        output,
        status: 'success',
        duration_ms: Math.round(performance.now() - tToolStart),
      });
      history.push({
        role: 'tool',
        content: JSON.stringify({ tool: decision.tool, output }).slice(0, 4000),
      });
    } catch (err) {
      steps.push({
        index: i,
        type: 'tool_call',
        tool: decision.tool,
        input: decision.args,
        status: 'failed',
        duration_ms: Math.round(performance.now() - tToolStart),
        message: (err as Error).message,
      });
      status = 'partial';
      history.push({
        role: 'tool',
        content: JSON.stringify({ tool: decision.tool, error: (err as Error).message }),
      });
    }
  }

  if (finalMessage === '' && steps.length === max) {
    status = 'partial';
    finalMessage = 'Agent hit maxIterations without producing a final answer.';
  }
  logger.info(
    {
      taskId,
      workspaceId: args.actor.workspaceId,
      userId: args.actor.userId,
      steps: steps.length,
      status,
    },
    'agent run complete',
  );
  return { task_id: taskId, status, goal: args.goal, steps, message: finalMessage };
}

interface AgentDecision {
  kind: 'tool';
  tool: string;
  args: Record<string, unknown>;
}
type ParsedDecision = AgentDecision | { kind: 'done'; message: string } | null;

function parseDecision(text: string): ParsedDecision {
  const trimmed = text.trim();
  const doneMatch = /^DONE:\s*(.*)$/is.exec(trimmed);
  if (doneMatch) {
    return { kind: 'done', message: doneMatch[1]?.trim() ?? '' };
  }
  const toolMatch = /^TOOL:\s*(\w+)\s+(\{.*\})$/s.exec(trimmed);
  if (toolMatch) {
    const toolName = toolMatch[1];
    const rawArgs = toolMatch[2];
    if (toolName === undefined || rawArgs === undefined) return null;
    try {
      const args = JSON.parse(rawArgs) as Record<string, unknown>;
      return { kind: 'tool', tool: toolName, args };
    } catch {
      return null;
    }
  }
  return null;
}

async function invokeTool(
  args: AgentRunArgs,
  tool: string,
  toolArgs: Record<string, unknown>,
): Promise<unknown> {
  switch (tool) {
    case 'search': {
      const query = String(toolArgs['query'] ?? '');
      if (query.trim() === '') {
        const rows = await args.handle.db
          .select({ id: schema.pages.id, createdAt: schema.pages.createdAt })
          .from(schema.pages)
          .where(
            and(
              eq(schema.pages.workspaceId, args.actor.workspaceId),
              eq(schema.pages.archived, false),
            ),
          )
          .limit(10);
        return { results: rows.map((r) => ({ id: r.id, created_at: r.createdAt.toISOString() })) };
      }
      const pattern = `%${query}%`;
      const blockRows = await args.handle.db
        .select({ parentId: schema.blocks.parentId, parentType: schema.blocks.parentType })
        .from(schema.blocks)
        .where(
          and(
            eq(schema.blocks.workspaceId, args.actor.workspaceId),
            eq(schema.blocks.archived, false),
            ilike(sql`${schema.blocks.content}::text`, pattern),
          ),
        )
        .limit(50);
      const candidatePageIds = Array.from(
        new Set(blockRows.filter((r) => r.parentType === 'page').map((r) => r.parentId)),
      );
      if (candidatePageIds.length === 0) return { results: [] };
      const pageRows = await args.handle.db
        .select({ id: schema.pages.id })
        .from(schema.pages)
        .where(
          and(
            eq(schema.pages.workspaceId, args.actor.workspaceId),
            eq(schema.pages.archived, false),
            inArray(schema.pages.id, candidatePageIds),
          ),
        )
        .limit(10);
      return { results: pageRows.map((r) => ({ id: r.id })) };
    }
    case 'get_page': {
      const id = String(toolArgs['id'] ?? '');
      const page = await getPage(args.handle.db, id);
      if (page === null) throw new Error(`Page ${id} not found`);
      const props =
        page.parentType === 'database' && page.parentId !== null
          ? await listProperties(args.handle.db, page.parentId)
          : [];
      return {
        id: page.id,
        parent_type: page.parentType,
        parent_id: page.parentId,
        archived: page.archived,
        property_count: props.length,
      };
    }
    case 'create_page': {
      const parentPageId = String(toolArgs['parent_page_id'] ?? '');
      const title = String(toolArgs['title'] ?? 'Untitled');
      if (parentPageId === '') throw new Error('parent_page_id required');
      const created = await createPage(args.handle.db, {
        workspaceId: args.actor.workspaceId,
        parentType: 'page',
        parentId: parentPageId,
        createdBy: args.actor.userId,
        lastEditedBy: args.actor.userId,
      });
      await appendChildren(args.handle.db, {
        workspaceId: args.actor.workspaceId,
        parentType: 'page',
        parentId: created.id,
        actor: args.actor.userId,
        children: [
          {
            type: 'heading_1',
            content: {
              heading_1: {
                rich_text: [
                  {
                    type: 'text',
                    text: { content: title, link: null },
                    plain_text: title,
                    href: null,
                    annotations: {},
                  },
                ],
                color: 'default',
              },
            },
          },
        ],
      });
      return { page_id: created.id, title };
    }
    case 'append_block': {
      const parentId = String(toolArgs['parent_id'] ?? '');
      const type = String(toolArgs['type'] ?? 'paragraph');
      const text = String(toolArgs['text'] ?? '');
      if (parentId === '') throw new Error('parent_id required');
      const inserted = await appendChildren(args.handle.db, {
        workspaceId: args.actor.workspaceId,
        parentType: 'block',
        parentId,
        actor: args.actor.userId,
        children: [
          {
            type,
            content: {
              [type]: {
                rich_text: [
                  {
                    type: 'text',
                    text: { content: text, link: null },
                    plain_text: text,
                    href: null,
                    annotations: {},
                  },
                ],
                color: 'default',
              },
            },
          },
        ],
      });
      return { block_id: inserted[0]?.id ?? null };
    }
    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}
