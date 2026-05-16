import {
  type ClientHandle,
  createIntegration,
  listIntegrationsByOwner,
  recordEvent,
  revokeIntegration,
} from '@bloc/db';
import { withSpan } from '@bloc/observability';
import { BlocNotFoundError, BlocValidationError } from '@bloc/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import '../types.ts';

interface Deps {
  handle: ClientHandle;
}

const CreateSchema = z
  .object({
    name: z.string().min(1).max(100),
    workspace_id: z.string().uuid(),
    capabilities: z
      .array(
        z.enum([
          'read_content',
          'update_content',
          'insert_content',
          'read_comments',
          'insert_comments',
          'read_user_with_email',
          'read_user_without_email',
        ]),
      )
      .min(1),
  })
  .strict();

interface SerializedIntegration {
  object: 'integration';
  id: string;
  name: string;
  workspace_id: string;
  owner_user_id: string;
  capabilities: string[];
  created_at: string;
  revoked_at: string | null;
}

function serialize(row: {
  id: string;
  name: string;
  workspaceId: string;
  ownerUserId: string;
  capabilities: string;
  createdAt: Date;
  revokedAt: Date | null;
}): SerializedIntegration {
  let caps: string[] = [];
  try {
    caps = JSON.parse(row.capabilities) as string[];
  } catch {
    caps = [];
  }
  return {
    object: 'integration',
    id: row.id,
    name: row.name,
    workspace_id: row.workspaceId,
    owner_user_id: row.ownerUserId,
    capabilities: caps,
    created_at: row.createdAt.toISOString(),
    revoked_at: row.revokedAt?.toISOString() ?? null,
  };
}

export function createIntegrationsRouter(deps: Deps): Hono {
  const router = new Hono();

  router.post('/', async (c) => {
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const body = CreateSchema.parse(await c.req.json());
    return withSpan('integrations', 'integrations.create', {}, async () => {
      if (body.workspace_id !== actor.workspaceId) {
        throw new BlocValidationError('workspace_id must match the actor workspace', requestId);
      }
      const { integration, token } = await createIntegration(deps.handle.db, {
        workspaceId: body.workspace_id,
        ownerUserId: actor.userId,
        name: body.name,
        capabilities: body.capabilities,
      });
      await recordEvent(deps.handle.db, {
        workspaceId: actor.workspaceId,
        actorUserId: actor.userId,
        action: 'integration.created',
        resourceType: 'integration',
        resourceId: integration.id,
      });
      return c.json({ ...serialize(integration), token });
    });
  });

  router.get('/', async (c) => {
    const actor = c.get('actor');
    return withSpan('integrations', 'integrations.list', {}, async () => {
      const rows = await listIntegrationsByOwner(deps.handle.db, actor.userId);
      return c.json({
        object: 'list',
        type: 'integration',
        results: rows.map(serialize),
        next_cursor: null,
        has_more: false,
        integration: {},
      });
    });
  });

  router.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    return withSpan('integrations', 'integrations.revoke', { 'integration.id': id }, async () => {
      const ok = await revokeIntegration(deps.handle.db, {
        id,
        ownerUserId: actor.userId,
      });
      if (!ok) throw new BlocNotFoundError(`Integration ${id} not found`, requestId);
      await recordEvent(deps.handle.db, {
        workspaceId: actor.workspaceId,
        actorUserId: actor.userId,
        action: 'integration.revoked',
        resourceType: 'integration',
        resourceId: id,
      });
      return c.body(null, 204);
    });
  });

  return router;
}
