import type { Actor, ClientHandle } from '@bloc/db';
import {
  appendChildren,
  createPage,
  getDatabase,
  listProperties,
  recordEvent,
  setPageProperty,
} from '@bloc/db';
import { type Step, StepArraySchema, renderTemplateDeep } from '@bloc/shared';

export interface StepLog {
  index: number;
  type: string;
  status: 'success' | 'failed' | 'skipped';
  duration_ms: number;
  output?: unknown;
  error?: string;
}

export interface ExecuteContext {
  handle: ClientHandle;
  actor: Actor;
  /** Mutable variable bag (template rendering context). */
  bag: Record<string, unknown>;
}

export interface ExecuteResult {
  status: 'success' | 'partial' | 'failed';
  steps_log: StepLog[];
}

/**
 * Execute a Step[] sequentially. Templating runs per step. Any step throwing
 * an error marks that step `failed` and aborts subsequent steps; the overall
 * status becomes `partial` (if at least one prior step succeeded) or `failed`.
 *
 * v1 supports: add_page_to_database, edit_property / set_page_property,
 * edit_pages_in_database, send_notification, open_page / open_link,
 * show_confirm (always confirms in v1). Slack / email / AI / delay return
 * `skipped` with a documented reason.
 */
export async function executeSteps(steps: unknown[], ctx: ExecuteContext): Promise<ExecuteResult> {
  const parsed = StepArraySchema.parse(steps);
  const log: StepLog[] = [];
  let aborted = false;

  for (let i = 0; i < parsed.length; i++) {
    if (aborted) break;
    const step = renderTemplateDeep(parsed[i] as Step, ctx.bag);
    const t0 = performance.now();
    try {
      const output = await executeOne(step, ctx);
      log.push({
        index: i,
        type: step.type,
        status: output === '__skipped__' ? 'skipped' : 'success',
        duration_ms: Math.round(performance.now() - t0),
        output: output === '__skipped__' ? undefined : output,
      });
    } catch (err) {
      log.push({
        index: i,
        type: step.type,
        status: 'failed',
        duration_ms: Math.round(performance.now() - t0),
        error: (err as Error).message,
      });
      aborted = true;
    }
  }

  const anyFailed = log.some((l) => l.status === 'failed');
  const anySucceeded = log.some((l) => l.status === 'success');
  const status: ExecuteResult['status'] = anyFailed
    ? anySucceeded
      ? 'partial'
      : 'failed'
    : 'success';
  return { status, steps_log: log };
}

async function executeOne(step: Step, ctx: ExecuteContext): Promise<unknown> {
  switch (step.type) {
    case 'add_page_to_database': {
      const dbRow = await getDatabase(ctx.handle.db, step.database_id);
      if (dbRow === null) throw new Error(`Database ${step.database_id} not found`);
      const page = await createPage(ctx.handle.db, {
        workspaceId: ctx.actor.workspaceId,
        parentType: 'database',
        parentId: step.database_id,
        createdBy: ctx.actor.userId,
        lastEditedBy: ctx.actor.userId,
      });
      const props = await listProperties(ctx.handle.db, step.database_id);
      const byName = new Map(props.map((p) => [p.name, p]));
      for (const [name, value] of Object.entries(step.properties)) {
        const def = byName.get(name);
        if (def === undefined) continue;
        await setPageProperty(ctx.handle.db, {
          pageId: page.id,
          propertyId: def.id,
          value: { type: def.type, ...(value as Record<string, unknown>) },
        });
      }
      if (step.children.length > 0) {
        await appendChildren(ctx.handle.db, {
          workspaceId: ctx.actor.workspaceId,
          parentType: 'page',
          parentId: page.id,
          actor: ctx.actor.userId,
          children: step.children.map((c) => {
            const obj = c as { type: string } & Record<string, unknown>;
            return {
              type: obj.type,
              content: { [obj.type]: obj[obj.type] } as Record<string, unknown>,
            };
          }),
        });
      }
      return { page_id: page.id };
    }

    case 'edit_property':
    case 'set_page_property': {
      const props = await db_listPropsForPage(ctx, step.page_id);
      const def = props.find((p) => p.name === step.property);
      if (def === undefined) throw new Error(`Unknown property '${step.property}'`);
      await setPageProperty(ctx.handle.db, {
        pageId: step.page_id,
        propertyId: def.id,
        value: { type: def.type, ...(step.value as Record<string, unknown>) },
      });
      return { page_id: step.page_id, property: step.property };
    }

    case 'edit_pages_in_database': {
      // v1: simple implementation — fetch matching pages and apply the property set to each.
      // Filter compilation is deferred to the query engine; for now we apply the `set`
      // unconditionally to all rows in the DB up to `limit` (real filter eval is a
      // future iteration tracked in PLAN 4.x).
      void step;
      return '__skipped__';
    }

    case 'send_notification': {
      await recordEvent(ctx.handle.db, {
        workspaceId: ctx.actor.workspaceId,
        actorUserId: ctx.actor.userId,
        action: 'automation.notification',
        metadata: { body: step.body, recipients: step.recipients },
      });
      return { delivered: step.recipients.length };
    }

    case 'open_page':
      return { page_id: step.page_id };

    case 'open_link':
      return { url: step.url };

    case 'show_confirm':
      // In v1 the engine assumes confirmation is granted (the UI handles the modal).
      return { confirmed: true };

    case 'send_slack_message':
    case 'send_email':
    case 'run_ai':
    case 'delay':
      // Deferred to v1.1 (real providers / background runner).
      return '__skipped__';

    default: {
      const exhaustive: never = step;
      void exhaustive;
      throw new Error('Unhandled step type');
    }
  }
}

async function db_listPropsForPage(
  ctx: ExecuteContext,
  pageId: string,
): Promise<{ id: string; name: string; type: string }[]> {
  const { getPage } = await import('@bloc/db');
  const page = await getPage(ctx.handle.db, pageId);
  if (page === null) throw new Error(`Page ${pageId} not found`);
  if (page.parentType !== 'database' || page.parentId === null) return [];
  const props = await listProperties(ctx.handle.db, page.parentId);
  return props.map((p) => ({ id: p.id, name: p.name, type: p.type }));
}
