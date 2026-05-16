import { type ClientHandle, getMemberRole, schema } from '@bloc/db';
import { withSpan } from '@bloc/observability';
import { BlocRestrictedError, BlocValidationError, encodeCursor } from '@bloc/shared';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import '../types.ts';

interface Deps {
  handle: ClientHandle;
}

const QuerySchema = z.object({
  actor: z.string().uuid().optional(),
  action: z.string().max(100).optional(),
  resource_type: z.string().max(40).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page_size: z.coerce.number().int().min(1).max(100).default(100),
  start_cursor: z.string().optional(),
});

export function createAuditRouter(deps: Deps): Hono {
  const router = new Hono();

  // GET /v1/workspaces/:id/audit_events
  router.get('/:id/audit_events', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    if (id !== actor.workspaceId) {
      throw new BlocValidationError('workspace id mismatch', requestId);
    }
    const role = await getMemberRole(deps.handle.db, {
      workspaceId: id,
      userId: actor.userId,
    });
    if (role !== 'owner' && role !== 'membership_admin') {
      throw new BlocRestrictedError(
        `Admin role required (actor has '${role ?? 'none'}')`,
        requestId,
      );
    }
    const url = new URL(c.req.url);
    const parsed = QuerySchema.parse(Object.fromEntries(url.searchParams));
    return withSpan('audit', 'audit.list', { 'workspace.id': id }, async () => {
      const conditions = [eq(schema.auditEvents.workspaceId, id)];
      if (parsed.actor !== undefined)
        conditions.push(eq(schema.auditEvents.actorUserId, parsed.actor));
      if (parsed.action !== undefined)
        conditions.push(eq(schema.auditEvents.action, parsed.action));
      if (parsed.resource_type !== undefined) {
        conditions.push(eq(schema.auditEvents.resourceType, parsed.resource_type));
      }
      if (parsed.from !== undefined) {
        conditions.push(gte(schema.auditEvents.createdAt, new Date(parsed.from)));
      }
      if (parsed.to !== undefined) {
        conditions.push(lte(schema.auditEvents.createdAt, new Date(parsed.to)));
      }
      let skip = 0;
      if (parsed.start_cursor !== undefined) {
        try {
          const { decodeCursor } = await import('@bloc/shared');
          const decoded = decodeCursor<{ skip: number }>(parsed.start_cursor);
          skip = Number(decoded.skip) || 0;
        } catch {
          throw new BlocValidationError('Invalid cursor', requestId);
        }
      }
      const limit = parsed.page_size + 1;
      const rows = await deps.handle.db
        .select()
        .from(schema.auditEvents)
        .where(and(...conditions))
        .orderBy(desc(schema.auditEvents.createdAt))
        .limit(limit)
        .offset(skip);
      const hasMore = rows.length > parsed.page_size;
      const window = hasMore ? rows.slice(0, parsed.page_size) : rows;
      return c.json({
        object: 'list',
        type: 'audit_event',
        results: window.map((r) => ({
          object: 'audit_event',
          id: r.id,
          workspace_id: r.workspaceId,
          actor_user_id: r.actorUserId,
          action: r.action,
          resource_type: r.resourceType,
          resource_id: r.resourceId,
          metadata: r.metadata,
          ip: r.ip,
          created_at: r.createdAt.toISOString(),
        })),
        next_cursor: hasMore ? encodeCursor({ skip: skip + parsed.page_size }) : null,
        has_more: hasMore,
        audit_event: {},
      });
    });
  });

  // GET /v1/workspaces/:id/audit_events:export.csv
  router.get('/:id/audit_events:export.csv', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    if (id !== actor.workspaceId) {
      throw new BlocValidationError('workspace id mismatch', requestId);
    }
    const role = await getMemberRole(deps.handle.db, {
      workspaceId: id,
      userId: actor.userId,
    });
    if (role !== 'owner' && role !== 'membership_admin') {
      throw new BlocRestrictedError(
        `Admin role required (actor has '${role ?? 'none'}')`,
        requestId,
      );
    }
    const rows = await deps.handle.db
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.workspaceId, id))
      .orderBy(desc(schema.auditEvents.createdAt))
      .limit(10_000);

    const lines = [
      'id,workspace_id,actor_user_id,action,resource_type,resource_id,created_at',
      ...rows.map(
        (r) =>
          `${r.id},${r.workspaceId},${r.actorUserId ?? ''},${r.action},${r.resourceType ?? ''},${r.resourceId ?? ''},${r.createdAt.toISOString()}`,
      ),
    ];
    c.header('content-type', 'text/csv');
    c.header('content-disposition', 'attachment; filename="audit_events.csv"');
    void sql; // keep tree-shaking import alive
    return c.body(lines.join('\n'));
  });

  return router;
}
