import {
  type ClientHandle,
  WORKSPACE_ROLES,
  type WorkspaceRole,
  addMember,
  getMemberRole,
  listMembers,
  recordEvent,
  removeMember,
} from '@bloc/db';
import { withSpan } from '@bloc/observability';
import { BlocRestrictedError, BlocValidationError } from '@bloc/shared';
import { type Context, Hono } from 'hono';
import { z } from 'zod';
import '../types.ts';

interface Deps {
  handle: ClientHandle;
}

const AddMemberSchema = z
  .object({
    user_id: z.string().uuid(),
    role: z.enum(WORKSPACE_ROLES as readonly string[] as [string, ...string[]]),
  })
  .strict();

const ChangeRoleSchema = z
  .object({
    role: z.enum(WORKSPACE_ROLES as readonly string[] as [string, ...string[]]),
  })
  .strict();

export function createWorkspaceMembersRouter(deps: Deps): Hono {
  const router = new Hono();

  async function requireAdmin(c: Context): Promise<void> {
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
  }

  // GET /v1/workspaces/:id/members
  router.get('/:id/members', async (c) => {
    const id = c.req.param('id');
    const actor = c.get('actor');
    const requestId = c.get('requestId');
    if (id !== actor.workspaceId) {
      throw new BlocValidationError('workspace id mismatch', requestId);
    }
    return withSpan(
      'workspace.members',
      'workspace.members.list',
      { 'workspace.id': id },
      async () => {
        const rows = await listMembers(deps.handle.db, id);
        return c.json({
          object: 'list',
          type: 'workspace_member',
          results: rows.map((r) => ({
            object: 'workspace_member',
            user_id: r.userId,
            role: r.role,
          })),
          next_cursor: null,
          has_more: false,
        });
      },
    );
  });

  // POST /v1/workspaces/:id/members
  router.post('/:id/members', async (c) => {
    const id = c.req.param('id');
    const actor = c.get('actor');
    const requestId = c.get('requestId');
    if (id !== actor.workspaceId) {
      throw new BlocValidationError('workspace id mismatch', requestId);
    }
    await requireAdmin(c);
    const body = AddMemberSchema.parse(await c.req.json());
    return withSpan('workspace.members', 'workspace.members.add', {}, async () => {
      await addMember(deps.handle.db, {
        workspaceId: id,
        userId: body.user_id,
        role: body.role as WorkspaceRole,
      });
      await recordEvent(deps.handle.db, {
        workspaceId: actor.workspaceId,
        actorUserId: actor.userId,
        action: 'workspace.member.added',
        resourceType: 'workspace',
        resourceId: id,
        metadata: { user_id: body.user_id, role: body.role },
      });
      return c.body(null, 204);
    });
  });

  // PATCH /v1/workspaces/:id/members/:userId — change role
  router.patch('/:id/members/:userId', async (c) => {
    const id = c.req.param('id');
    const userId = c.req.param('userId');
    const actor = c.get('actor');
    const requestId = c.get('requestId');
    if (id !== actor.workspaceId) {
      throw new BlocValidationError('workspace id mismatch', requestId);
    }
    await requireAdmin(c);
    const body = ChangeRoleSchema.parse(await c.req.json());
    return withSpan('workspace.members', 'workspace.members.role_changed', {}, async () => {
      // Implemented as remove + add since the membership composite PK is
      // (workspace_id, user_id) and the `addMember` helper is onConflictDoNothing.
      // We do an upsert by removing the prior row first.
      const prior = await getMemberRole(deps.handle.db, { workspaceId: id, userId });
      if (prior === null) {
        throw new BlocValidationError(`User ${userId} is not a member`, requestId);
      }
      await removeMember(deps.handle.db, { workspaceId: id, userId });
      await addMember(deps.handle.db, {
        workspaceId: id,
        userId,
        role: body.role as WorkspaceRole,
      });
      await recordEvent(deps.handle.db, {
        workspaceId: actor.workspaceId,
        actorUserId: actor.userId,
        action: 'workspace.member.role_changed',
        resourceType: 'workspace',
        resourceId: id,
        metadata: { user_id: userId, from: prior, to: body.role },
      });
      return c.body(null, 204);
    });
  });

  // DELETE /v1/workspaces/:id/members/:userId
  router.delete('/:id/members/:userId', async (c) => {
    const id = c.req.param('id');
    const userId = c.req.param('userId');
    const actor = c.get('actor');
    const requestId = c.get('requestId');
    if (id !== actor.workspaceId) {
      throw new BlocValidationError('workspace id mismatch', requestId);
    }
    await requireAdmin(c);
    return withSpan('workspace.members', 'workspace.members.remove', {}, async () => {
      await removeMember(deps.handle.db, { workspaceId: id, userId });
      await recordEvent(deps.handle.db, {
        workspaceId: actor.workspaceId,
        actorUserId: actor.userId,
        action: 'workspace.member.removed',
        resourceType: 'workspace',
        resourceId: id,
        metadata: { user_id: userId },
      });
      return c.body(null, 204);
    });
  });

  return router;
}
