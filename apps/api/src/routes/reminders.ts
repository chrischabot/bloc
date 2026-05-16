import {
  type ClientHandle,
  type Reminder,
  createReminder,
  deleteReminder,
  findDueReminders,
  getMemberRole,
  getReminder,
  listRemindersForUser,
  markFired,
  recordEvent,
  requirePermission,
} from '@bloc/db';
import { withSpan } from '@bloc/observability';
import { BlocNotFoundError, BlocRestrictedError, BlocValidationError } from '@bloc/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import '../types.ts';

interface Deps {
  handle: ClientHandle;
}

const CreateSchema = z
  .object({
    parent: z.object({
      type: z.enum(['page', 'block']),
      id: z.string().uuid(),
    }),
    due_at: z.string().datetime(),
    label: z.string().max(200).optional(),
    user_id: z.string().uuid().optional(),
  })
  .strict();

interface SerializedReminder {
  object: 'reminder';
  id: string;
  workspace_id: string;
  parent: { type: 'page' | 'block'; id: string };
  user_id: string;
  due_at: string;
  label: string | null;
  fired: boolean;
  fired_at: string | null;
  created_by: string;
  created_at: string;
}

function serialize(r: Reminder): SerializedReminder {
  return {
    object: 'reminder',
    id: r.id,
    workspace_id: r.workspaceId,
    parent: { type: r.parentType as 'page' | 'block', id: r.parentId },
    user_id: r.userId,
    due_at: r.dueAt.toISOString(),
    label: r.label,
    fired: r.fired,
    fired_at: r.firedAt?.toISOString() ?? null,
    created_by: r.createdBy,
    created_at: r.createdAt.toISOString(),
  };
}

export function createRemindersRouter(deps: Deps): Hono {
  const router = new Hono();

  // Literal route registered first so it isn't shadowed by /:id.
  // Admin-only (owner / membership_admin); the deferred worker is expected to
  // authenticate as a workspace owner.
  router.post('/scan-due', async (c) => {
    const actor = c.get('actor');
    const requestId = c.get('requestId');
    const role = await getMemberRole(deps.handle.db, {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
    });
    if (role !== 'owner' && role !== 'membership_admin') {
      throw new BlocRestrictedError(
        `Admin role required (actor has '${role ?? 'none'}')`,
        requestId,
      );
    }
    return withSpan('reminders', 'reminders.scan_due', {}, async () => {
      const at = new Date();
      const due = await findDueReminders(deps.handle.db, { at, limit: 500 });
      return c.json({
        object: 'list',
        type: 'reminder',
        results: due.map(serialize),
        now: at.toISOString(),
        next_cursor: null,
        has_more: false,
      });
    });
  });

  router.post('/', async (c) => {
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const body = CreateSchema.parse(await c.req.json());
    const dueAt = new Date(body.due_at);
    if (Number.isNaN(dueAt.getTime())) {
      throw new BlocValidationError('due_at must be a valid ISO 8601 timestamp', requestId);
    }
    await requirePermission(
      deps.handle.db,
      actor,
      { type: 'page', id: body.parent.id },
      'can_comment',
    );
    return withSpan(
      'reminders',
      'reminders.create',
      { 'parent.type': body.parent.type, 'parent.id': body.parent.id },
      async () => {
        const args: Parameters<typeof createReminder>[1] = {
          workspaceId: actor.workspaceId,
          parentType: body.parent.type,
          parentId: body.parent.id,
          userId: body.user_id ?? actor.userId,
          dueAt,
          createdBy: actor.userId,
        };
        if (body.label !== undefined) args.label = body.label;
        const row = await createReminder(deps.handle.db, args);
        return c.json(serialize(row));
      },
    );
  });

  router.get('/', async (c) => {
    const actor = c.get('actor');
    const url = new URL(c.req.url);
    const includeFired = url.searchParams.get('include_fired') === 'true';
    const pageSize = Math.max(1, Math.min(200, Number(url.searchParams.get('page_size') ?? 100)));
    return withSpan('reminders', 'reminders.list', { 'user.id': actor.userId }, async () => {
      const rows = await listRemindersForUser(deps.handle.db, {
        userId: actor.userId,
        includeFired,
        limit: pageSize,
      });
      return c.json({
        object: 'list',
        type: 'reminder',
        results: rows.map(serialize),
        next_cursor: null,
        has_more: false,
        reminder: {},
      });
    });
  });

  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const row = await getReminder(deps.handle.db, id);
    if (row === null) throw new BlocNotFoundError(`Reminder ${id} not found`, requestId);
    if (row.userId !== actor.userId && row.createdBy !== actor.userId) {
      throw new BlocNotFoundError(`Reminder ${id} not found`, requestId);
    }
    return c.json(serialize(row));
  });

  router.post('/:id/fire', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const existing = await getReminder(deps.handle.db, id);
    if (existing === null) throw new BlocNotFoundError(`Reminder ${id} not found`, requestId);
    if (existing.userId !== actor.userId && existing.createdBy !== actor.userId) {
      throw new BlocNotFoundError(`Reminder ${id} not found`, requestId);
    }
    const row = await markFired(deps.handle.db, id);
    if (row === null) throw new BlocNotFoundError(`Reminder ${id} not found`, requestId);
    await recordEvent(deps.handle.db, {
      workspaceId: actor.workspaceId,
      actorUserId: actor.userId,
      action: 'reminder.fired',
      resourceType: existing.parentType,
      resourceId: existing.parentId,
    });
    return c.json(serialize(row));
  });

  router.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const existing = await getReminder(deps.handle.db, id);
    if (existing === null) throw new BlocNotFoundError(`Reminder ${id} not found`, requestId);
    if (existing.userId !== actor.userId && existing.createdBy !== actor.userId) {
      throw new BlocNotFoundError(`Reminder ${id} not found`, requestId);
    }
    const ok = await deleteReminder(deps.handle.db, id);
    if (!ok) throw new BlocNotFoundError(`Reminder ${id} not found`, requestId);
    return c.body(null, 204);
  });

  return router;
}
