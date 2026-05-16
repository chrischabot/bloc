import {
  type ClientHandle,
  type Webhook,
  createWebhook,
  deleteWebhook,
  getWebhook,
  listDeliveries,
  listWebhooks,
  recordEvent,
  updateWebhook,
} from '@bloc/db';
import { withSpan } from '@bloc/observability';
import { HttpsUrlSchema, BlocNotFoundError, BlocValidationError } from '@bloc/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import '../types.ts';
import { dispatchEvent, performVerification } from '../webhooks/dispatcher.ts';

interface Deps {
  handle: ClientHandle;
  /** Optional fetch override for tests. */
  fetch?: typeof fetch;
}

/** Catalogued event types per docs/api/endpoints/webhooks.md. */
const SUPPORTED_EVENT_TYPES = [
  'page.created',
  'page.updated',
  'page.archived',
  'page.unarchived',
  'page.deleted',
  'block.appended',
  'block.updated',
  'block.deleted',
  'database.created',
  'database.updated',
  'comment.created',
  'comment.resolved',
  'automation.run.completed',
  'form.submission.created',
  'publication.created',
  'publication.deleted',
  'wiki.verification.changed',
] as const;

const CreateSchema = z
  .object({
    endpoint_url: HttpsUrlSchema,
    subscribed_events: z.array(z.enum(SUPPORTED_EVENT_TYPES)).min(1).max(25),
    filter: z
      .object({
        workspace_id: z.string().uuid().optional(),
        page_ids: z.array(z.string().uuid()).max(100).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const UpdateSchema = z
  .object({
    endpoint_url: HttpsUrlSchema.optional(),
    subscribed_events: z.array(z.enum(SUPPORTED_EVENT_TYPES)).min(1).max(25).optional(),
    filter: z
      .object({
        workspace_id: z.string().uuid().optional(),
        page_ids: z.array(z.string().uuid()).max(100).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

function serialize(row: Webhook, opts: { includeSecret?: boolean } = {}): Record<string, unknown> {
  const events = row.subscribedEvents ?? [];
  const out: Record<string, unknown> = {
    object: 'webhook',
    id: row.id,
    endpoint_url: row.endpointUrl,
    subscribed_events: events,
    status: row.status,
    failure_streak: row.failureStreak,
    enabled: row.enabled,
    filter: row.filter,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
  if (opts.includeSecret) out['signing_secret'] = row.signingSecret;
  return out;
}

export function createWebhooksRouter(deps: Deps): Hono {
  const router = new Hono();
  const fetchImpl = deps.fetch ?? globalThis.fetch.bind(globalThis);

  router.post('/', async (c) => {
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const body = CreateSchema.parse(await c.req.json());
    return withSpan('webhooks', 'webhooks.create', {}, async () => {
      // Enforce ≤ 100 webhooks per workspace.
      const existing = await listWebhooks(deps.handle.db, actor.workspaceId);
      if (existing.length >= 100) {
        throw new BlocValidationError('Maximum 100 webhooks per workspace', requestId);
      }
      const args: Parameters<typeof createWebhook>[1] = {
        workspaceId: actor.workspaceId,
        ownerUserId: actor.userId,
        endpointUrl: body.endpoint_url,
        subscribedEvents: body.subscribed_events,
      };
      if (actor.integrationId !== undefined) args.integrationId = actor.integrationId;
      if (body.filter !== undefined) args.filter = body.filter as Record<string, unknown>;
      const created = await createWebhook(deps.handle.db, args);
      await recordEvent(deps.handle.db, {
        workspaceId: actor.workspaceId,
        actorUserId: actor.userId,
        action: 'webhook.created',
        resourceType: 'webhook',
        resourceId: created.id,
      });

      // Kick off verification synchronously (v1.1 will move to a worker).
      const result = await performVerification(deps.handle, created, fetchImpl);
      const fresh = await getWebhook(deps.handle.db, created.id);
      const row = fresh ?? created;
      return c.json({
        ...serialize(row, { includeSecret: true }),
        verification: { ok: result.ok, status: result.status },
      });
    });
  });

  router.get('/', async (c) => {
    const actor = c.get('actor');
    const rows = await listWebhooks(deps.handle.db, actor.workspaceId);
    return c.json({
      object: 'list',
      type: 'webhook',
      results: rows.map((r) => serialize(r)),
      next_cursor: null,
      has_more: false,
      webhook: {},
    });
  });

  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const row = await getWebhook(deps.handle.db, id);
    if (row === null || row.workspaceId !== actor.workspaceId) {
      throw new BlocNotFoundError(`Webhook ${id} not found`, requestId);
    }
    return c.json(serialize(row));
  });

  router.patch('/:id', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const row = await getWebhook(deps.handle.db, id);
    if (row === null || row.workspaceId !== actor.workspaceId) {
      throw new BlocNotFoundError(`Webhook ${id} not found`, requestId);
    }
    const body = UpdateSchema.parse(await c.req.json());
    const updatePatch: Parameters<typeof updateWebhook>[2] = {};
    if (body.endpoint_url !== undefined) updatePatch.endpointUrl = body.endpoint_url;
    if (body.subscribed_events !== undefined) updatePatch.subscribedEvents = body.subscribed_events;
    if (body.filter !== undefined) updatePatch.filter = body.filter as Record<string, unknown>;
    // Changing the endpoint resets verification.
    if (body.endpoint_url !== undefined && body.endpoint_url !== row.endpointUrl) {
      updatePatch.status = 'unverified';
      updatePatch.failureStreak = 0;
    }
    const updated = await updateWebhook(deps.handle.db, id, updatePatch);
    if (updated === null) throw new BlocNotFoundError(`Webhook ${id} not found`, requestId);
    if (body.endpoint_url !== undefined && body.endpoint_url !== row.endpointUrl) {
      await performVerification(deps.handle, updated, fetchImpl);
    }
    const fresh = await getWebhook(deps.handle.db, id);
    return c.json(serialize(fresh ?? updated));
  });

  router.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const row = await getWebhook(deps.handle.db, id);
    if (row === null || row.workspaceId !== actor.workspaceId) {
      throw new BlocNotFoundError(`Webhook ${id} not found`, requestId);
    }
    await deleteWebhook(deps.handle.db, id);
    await recordEvent(deps.handle.db, {
      workspaceId: actor.workspaceId,
      actorUserId: actor.userId,
      action: 'webhook.deleted',
      resourceType: 'webhook',
      resourceId: id,
    });
    return c.body(null, 204);
  });

  router.post('/:id/ping', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const row = await getWebhook(deps.handle.db, id);
    if (row === null || row.workspaceId !== actor.workspaceId) {
      throw new BlocNotFoundError(`Webhook ${id} not found`, requestId);
    }
    const result = await dispatchEvent(deps.handle, {
      workspaceId: actor.workspaceId,
      eventType: 'webhook.ping',
      data: { ping: true },
      fetch: fetchImpl,
    });
    return c.json({ object: 'webhook_ping', ...result });
  });

  router.get('/:id/deliveries', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const row = await getWebhook(deps.handle.db, id);
    if (row === null || row.workspaceId !== actor.workspaceId) {
      throw new BlocNotFoundError(`Webhook ${id} not found`, requestId);
    }
    const rows = await listDeliveries(deps.handle.db, id);
    return c.json({
      object: 'list',
      type: 'webhook_delivery',
      results: rows.map((r) => ({
        object: 'webhook_delivery',
        id: r.id,
        webhook_id: r.webhookId,
        event_id: r.eventId,
        event_type: r.eventType,
        status: r.status,
        http_status: r.httpStatus,
        attempt: r.attempt,
        latency_ms: r.latencyMs,
        error: r.error,
        created_at: r.createdAt.toISOString(),
      })),
      next_cursor: null,
      has_more: false,
      webhook_delivery: {},
    });
  });

  return router;
}
