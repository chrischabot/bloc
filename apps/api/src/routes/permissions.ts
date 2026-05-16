import {
  type ClientHandle,
  PERMISSION_LEVELS,
  grant,
  recordEvent,
  requirePermission,
  resolveLevel,
  revoke,
  schema,
} from '@bloc/db';
import { withSpan } from '@bloc/observability';
import { BlocValidationError } from '@bloc/shared';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import '../types.ts';

interface Deps {
  handle: ClientHandle;
}

const GrantSchema = z
  .object({
    grantee_type: z.enum(['user', 'workspace', 'public', 'link', 'teamspace', 'group']),
    grantee_id: z.string().uuid().nullable().optional(),
    level: z.enum(PERMISSION_LEVELS as readonly string[] as [string, ...string[]]),
  })
  .strict();

export function createPermissionsRouter(deps: Deps): Hono {
  const router = new Hono();

  // GET /v1/pages/:id/permissions
  router.get('/:id/permissions', async (c) => {
    const id = c.req.param('id');
    const actor = c.get('actor');
    return withSpan('permissions', 'permissions.list', { 'page.id': id }, async () => {
      await requirePermission(deps.handle.db, actor, { type: 'page', id }, 'can_read');
      const rows = await deps.handle.db
        .select()
        .from(schema.permissions)
        .where(
          and(eq(schema.permissions.resourceType, 'page'), eq(schema.permissions.resourceId, id)),
        );
      return c.json({
        object: 'list',
        type: 'permission',
        results: rows.map((r) => ({
          object: 'permission',
          id: r.id,
          grantee_type: r.granteeType,
          grantee_id: r.granteeId,
          level: r.level,
          created_at: r.createdAt.toISOString(),
        })),
        next_cursor: null,
        has_more: false,
        permission: {},
      });
    });
  });

  // POST /v1/pages/:id/permissions
  router.post('/:id/permissions', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const body = GrantSchema.parse(await c.req.json());
    return withSpan('permissions', 'permissions.grant', { 'page.id': id }, async () => {
      await requirePermission(deps.handle.db, actor, { type: 'page', id }, 'full_access');
      if (
        (body.grantee_type === 'user' ||
          body.grantee_type === 'group' ||
          body.grantee_type === 'teamspace') &&
        (body.grantee_id === null || body.grantee_id === undefined)
      ) {
        throw new BlocValidationError(
          `grantee_id required when grantee_type is '${body.grantee_type}'`,
          requestId,
        );
      }
      const insertArgs: typeof schema.permissions.$inferInsert = {
        resourceType: 'page',
        resourceId: id,
        granteeType: body.grantee_type,
        level: body.level,
        createdBy: actor.userId,
      };
      if (body.grantee_id !== null && body.grantee_id !== undefined) {
        insertArgs.granteeId = body.grantee_id;
      }
      await grant(deps.handle.db, insertArgs);
      await recordEvent(deps.handle.db, {
        workspaceId: actor.workspaceId,
        actorUserId: actor.userId,
        action: 'permission.granted',
        resourceType: 'page',
        resourceId: id,
        metadata: {
          grantee_type: body.grantee_type,
          grantee_id: body.grantee_id ?? null,
          level: body.level,
        },
      });
      return c.body(null, 204);
    });
  });

  // DELETE /v1/pages/:id/permissions
  router.delete('/:id/permissions', async (c) => {
    const id = c.req.param('id');
    const actor = c.get('actor');
    const url = new URL(c.req.url);
    const granteeId = url.searchParams.get('grantee_id') ?? undefined;
    return withSpan('permissions', 'permissions.revoke', { 'page.id': id }, async () => {
      await requirePermission(deps.handle.db, actor, { type: 'page', id }, 'full_access');
      const revokeArgs: Parameters<typeof revoke>[1] = {
        resourceType: 'page',
        resourceId: id,
      };
      if (granteeId !== undefined) revokeArgs.granteeId = granteeId;
      await revoke(deps.handle.db, revokeArgs);
      await recordEvent(deps.handle.db, {
        workspaceId: actor.workspaceId,
        actorUserId: actor.userId,
        action: 'permission.revoked',
        resourceType: 'page',
        resourceId: id,
        metadata: { grantee_id: granteeId ?? null },
      });
      return c.body(null, 204);
    });
  });

  // GET /v1/pages/:id/permissions/me — convenience to check the actor's level
  router.get('/:id/permissions/me', async (c) => {
    const id = c.req.param('id');
    const actor = c.get('actor');
    const level = await resolveLevel(deps.handle.db, actor, { type: 'page', id });
    return c.json({ object: 'permission', level });
  });

  return router;
}
