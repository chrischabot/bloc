import {
  type ClientHandle,
  createAutomation,
  deleteAutomation,
  getAutomation,
  getDatabase,
  listAutomationRuns,
  listAutomations,
  recordRun,
  requirePermission,
  updateAutomation,
} from '@bloc/db';
import { withSpan } from '@bloc/observability';
import {
  BlocNotFoundError,
  BlocValidationError,
  StepArraySchema,
  TriggerSchema,
} from '@bloc/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import '../types.ts';
import { executeSteps } from '../automations/executor.ts';
import { type Emitter, makeEmitter } from '../webhooks/emit.ts';

interface Deps {
  handle: ClientHandle;
  emit?: Emitter;
}

const CreateSchema = z
  .object({
    name: z.string().min(1).max(120),
    trigger: TriggerSchema,
    steps: StepArraySchema,
    enabled: z.boolean().optional(),
  })
  .strict();

const UpdateSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    trigger: TriggerSchema.optional(),
    steps: StepArraySchema.optional(),
    enabled: z.boolean().optional(),
  })
  .strict();

interface SerializedAutomation {
  object: 'automation';
  id: string;
  database_id: string;
  name: string;
  enabled: boolean;
  trigger: unknown;
  steps: unknown;
  last_run_at: string | null;
  runs_count: number;
  created_time: string;
  last_edited_time: string;
}

function serialize(row: {
  id: string;
  databaseId: string;
  name: string;
  enabled: boolean;
  trigger: unknown;
  steps: unknown;
  lastRunAt: Date | null;
  runsCount: number;
  createdAt: Date;
  updatedAt: Date;
}): SerializedAutomation {
  return {
    object: 'automation',
    id: row.id,
    database_id: row.databaseId,
    name: row.name,
    enabled: row.enabled,
    trigger: row.trigger,
    steps: row.steps,
    last_run_at: row.lastRunAt?.toISOString() ?? null,
    runs_count: row.runsCount,
    created_time: row.createdAt.toISOString(),
    last_edited_time: row.updatedAt.toISOString(),
  };
}

export function createAutomationsRouter(deps: Deps): Hono {
  const router = new Hono();
  const emit = deps.emit ?? makeEmitter(deps.handle);

  // GET /v1/databases/:databaseId/automations
  router.get('/databases/:databaseId/automations', async (c) => {
    const dbId = c.req.param('databaseId');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const dbRow = await getDatabase(deps.handle.db, dbId);
    if (dbRow === null) throw new BlocNotFoundError(`Database ${dbId} not found`, requestId);
    await requirePermission(deps.handle.db, actor, { type: 'database', id: dbId }, 'can_read');
    return withSpan('automations', 'automations.list', { 'database.id': dbId }, async () => {
      const rows = await listAutomations(deps.handle.db, dbId);
      return c.json({
        object: 'list',
        type: 'automation',
        results: rows.map(serialize),
        next_cursor: null,
        has_more: false,
        automation: {},
      });
    });
  });

  // POST /v1/databases/:databaseId/automations
  router.post('/databases/:databaseId/automations', async (c) => {
    const dbId = c.req.param('databaseId');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const dbRow = await getDatabase(deps.handle.db, dbId);
    if (dbRow === null) throw new BlocNotFoundError(`Database ${dbId} not found`, requestId);
    await requirePermission(deps.handle.db, actor, { type: 'database', id: dbId }, 'can_edit');
    const body = CreateSchema.parse(await c.req.json());
    return withSpan('automations', 'automations.create', { 'database.id': dbId }, async () => {
      const row = await createAutomation(deps.handle.db, {
        databaseId: dbId,
        name: body.name,
        trigger: body.trigger,
        steps: body.steps,
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
        createdBy: actor.userId,
      });
      return c.json(serialize(row));
    });
  });

  // PATCH /v1/automations/:id
  router.patch('/automations/:id', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const existing = await getAutomation(deps.handle.db, id);
    if (existing === null) throw new BlocNotFoundError(`Automation ${id} not found`, requestId);
    await requirePermission(
      deps.handle.db,
      actor,
      { type: 'database', id: existing.databaseId },
      'can_edit',
    );
    const body = UpdateSchema.parse(await c.req.json());
    return withSpan('automations', 'automations.update', { 'automation.id': id }, async () => {
      const next = await updateAutomation(deps.handle.db, id, body);
      if (next === null) throw new BlocNotFoundError(`Automation ${id} not found`, requestId);
      return c.json(serialize(next));
    });
  });

  // DELETE /v1/automations/:id
  router.delete('/automations/:id', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const existing = await getAutomation(deps.handle.db, id);
    if (existing === null) throw new BlocNotFoundError(`Automation ${id} not found`, requestId);
    await requirePermission(
      deps.handle.db,
      actor,
      { type: 'database', id: existing.databaseId },
      'can_edit',
    );
    const ok = await deleteAutomation(deps.handle.db, id);
    if (!ok) throw new BlocNotFoundError(`Automation ${id} not found`, requestId);
    return c.body(null, 204);
  });

  // GET /v1/automations/:id/runs
  router.get('/automations/:id/runs', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const existing = await getAutomation(deps.handle.db, id);
    if (existing === null) throw new BlocNotFoundError(`Automation ${id} not found`, requestId);
    const rows = await listAutomationRuns(deps.handle.db, id);
    return c.json({
      object: 'list',
      type: 'automation_run',
      results: rows.map((r) => ({
        object: 'automation_run',
        id: r.id,
        automation_id: r.automationId,
        status: r.status,
        steps_log: r.stepsLog,
        started_at: r.startedAt.toISOString(),
        ended_at: r.endedAt?.toISOString() ?? null,
      })),
      next_cursor: null,
      has_more: false,
    });
  });

  // POST /v1/automations/:id/runs:test — dry run against a sample page
  router.post('/automations/:id/runs:test', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const existing = await getAutomation(deps.handle.db, id);
    if (existing === null) throw new BlocNotFoundError(`Automation ${id} not found`, requestId);
    const body = z
      .object({
        sample_page_id: z.string().uuid().optional(),
        context: z.record(z.string(), z.unknown()).optional(),
      })
      .strict()
      .parse(await c.req.json().catch(() => ({})));
    if (existing.enabled === false) {
      throw new BlocValidationError('Cannot run a disabled automation', requestId);
    }
    const bag: Record<string, unknown> = {
      actor: { id: actor.userId, workspaceId: actor.workspaceId },
      now: new Date().toISOString(),
      ...(body.sample_page_id !== undefined ? { page: { id: body.sample_page_id } } : {}),
      ...(body.context ?? {}),
    };
    const result = await executeSteps(existing.steps as unknown[], {
      handle: deps.handle,
      actor,
      bag,
    });
    const run = await recordRun(deps.handle.db, {
      automationId: id,
      status: result.status,
      stepsLog: result.steps_log,
    });
    await emit({
      workspaceId: actor.workspaceId,
      type: 'automation.run.completed',
      data: {
        automation_id: id,
        run_id: run.id,
        status: result.status,
      },
    });
    return c.json({
      object: 'automation_run',
      id: run.id,
      automation_id: id,
      status: result.status,
      steps: result.steps_log,
      started_at: run.startedAt.toISOString(),
      ended_at: run.endedAt?.toISOString() ?? null,
    });
  });

  return router;
}
