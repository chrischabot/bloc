import { type ClientHandle, getPage, recordEvent, requirePermission, schema } from '@bloc/db';
import { withSpan } from '@bloc/observability';
import { BlocNotFoundError, BlocValidationError } from '@bloc/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import '../types.ts';
import { type Emitter, makeEmitter } from '../webhooks/emit.ts';

interface Deps {
  handle: ClientHandle;
  emit?: Emitter;
}

const VerifySchema = z
  .object({
    expires_in_days: z.number().int().min(1).max(3650).nullable().optional(),
  })
  .strict();

export function createWikisRouter(deps: Deps): Hono {
  const router = new Hono();
  const emit = deps.emit ?? makeEmitter(deps.handle);

  // POST /v1/pages/:id/wiki
  router.post('/:id/wiki', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const page = await getPage(deps.handle.db, id);
    if (page === null) throw new BlocNotFoundError(`Page ${id} not found`, requestId);
    await requirePermission(deps.handle.db, actor, { type: 'page', id }, 'full_access');
    return withSpan('wikis', 'wikis.turn_on', { 'page.id': id }, async () => {
      await deps.handle.db
        .update(schema.pages)
        .set({ isWiki: true, lastEditedBy: actor.userId, lastEditedAt: new Date() })
        .where(eq(schema.pages.id, id));
      await recordEvent(deps.handle.db, {
        workspaceId: actor.workspaceId,
        actorUserId: actor.userId,
        action: 'wiki.turned_on',
        resourceType: 'page',
        resourceId: id,
      });
      return c.json({ object: 'wiki', page_id: id, is_wiki: true });
    });
  });

  // DELETE /v1/pages/:id/wiki
  router.delete('/:id/wiki', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const page = await getPage(deps.handle.db, id);
    if (page === null) throw new BlocNotFoundError(`Page ${id} not found`, requestId);
    await requirePermission(deps.handle.db, actor, { type: 'page', id }, 'full_access');
    await deps.handle.db
      .update(schema.pages)
      .set({ isWiki: false, lastEditedBy: actor.userId, lastEditedAt: new Date() })
      .where(eq(schema.pages.id, id));
    await recordEvent(deps.handle.db, {
      workspaceId: actor.workspaceId,
      actorUserId: actor.userId,
      action: 'wiki.turned_off',
      resourceType: 'page',
      resourceId: id,
    });
    return c.body(null, 204);
  });

  // POST /v1/pages/:id/verify
  router.post('/:id/verify', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const page = await getPage(deps.handle.db, id);
    if (page === null) throw new BlocNotFoundError(`Page ${id} not found`, requestId);
    if (page.isWiki !== true) {
      throw new BlocValidationError('Page is not a wiki', requestId);
    }
    await requirePermission(deps.handle.db, actor, { type: 'page', id }, 'can_edit');
    const body = VerifySchema.parse(await c.req.json().catch(() => ({})));
    const now = new Date();
    const expiresAt =
      body.expires_in_days === null || body.expires_in_days === undefined
        ? null
        : new Date(now.getTime() + body.expires_in_days * 86_400_000);
    const verification = {
      state: 'verified',
      verified_by: { object: 'user', id: actor.userId },
      verified_at: now.toISOString(),
      expires_at: expiresAt?.toISOString() ?? null,
    };
    return withSpan('wikis', 'wikis.verify', { 'page.id': id }, async () => {
      await deps.handle.db
        .update(schema.pages)
        .set({
          verification: verification as Record<string, unknown>,
          lastEditedBy: actor.userId,
          lastEditedAt: new Date(),
        })
        .where(eq(schema.pages.id, id));
      await recordEvent(deps.handle.db, {
        workspaceId: actor.workspaceId,
        actorUserId: actor.userId,
        action: 'wiki.verified',
        resourceType: 'page',
        resourceId: id,
        metadata: { expires_at: verification.expires_at },
      });
      await emit({
        workspaceId: actor.workspaceId,
        type: 'wiki.verification.changed',
        data: { page_id: id, ...verification },
      });
      return c.json({ object: 'verification', page_id: id, ...verification });
    });
  });

  // POST /v1/pages/:id/unverify
  router.post('/:id/unverify', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const page = await getPage(deps.handle.db, id);
    if (page === null) throw new BlocNotFoundError(`Page ${id} not found`, requestId);
    await requirePermission(deps.handle.db, actor, { type: 'page', id }, 'can_edit');
    return withSpan('wikis', 'wikis.unverify', { 'page.id': id }, async () => {
      await deps.handle.db
        .update(schema.pages)
        .set({
          verification: { state: 'unverified' } as Record<string, unknown>,
          lastEditedBy: actor.userId,
          lastEditedAt: new Date(),
        })
        .where(eq(schema.pages.id, id));
      await recordEvent(deps.handle.db, {
        workspaceId: actor.workspaceId,
        actorUserId: actor.userId,
        action: 'wiki.unverified',
        resourceType: 'page',
        resourceId: id,
      });
      await emit({
        workspaceId: actor.workspaceId,
        type: 'wiki.verification.changed',
        data: {
          page_id: id,
          state: 'unverified',
          verified_by: null,
          verified_at: null,
          expires_at: null,
        },
      });
      return c.json({
        object: 'verification',
        page_id: id,
        state: 'unverified',
        verified_by: null,
        verified_at: null,
        expires_at: null,
      });
    });
  });

  return router;
}
