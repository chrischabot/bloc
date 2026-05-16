import {
  type ClientHandle,
  getPage,
  listBacklinksForTarget,
  reindexBacklinksForPage,
  requirePermission,
  resolveLevel,
} from '@bloc/db';
import { withSpan } from '@bloc/observability';
import { BlocNotFoundError, encodeCursor } from '@bloc/shared';
import { Hono } from 'hono';
import '../types.ts';

interface Deps {
  handle: ClientHandle;
}

export function createBacklinksRouter(deps: Deps): Hono {
  const router = new Hono();

  // GET /v1/pages/:id/backlinks
  router.get('/:id/backlinks', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const url = new URL(c.req.url);
    const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get('page_size') ?? 100)));

    return withSpan('backlinks', 'backlinks.list', { 'page.id': id }, async () => {
      await requirePermission(deps.handle.db, actor, { type: 'page', id }, 'can_read');
      const page = await getPage(deps.handle.db, id);
      if (page === null) throw new BlocNotFoundError(`Page ${id} not found`, requestId);

      const rows = await listBacklinksForTarget(deps.handle.db, id, 1000);
      // Filter: drop entries from source pages the actor cannot read.
      const visible = [];
      for (const r of rows) {
        const level = await resolveLevel(deps.handle.db, actor, {
          type: 'page',
          id: r.sourcePageId,
        });
        if (level === 'no_access') continue;
        visible.push(r);
      }
      const window = visible.slice(0, pageSize);
      const hasMore = visible.length > pageSize;
      return c.json({
        object: 'list',
        type: 'backlink',
        results: window.map((r) => ({
          object: 'backlink',
          source_page_id: r.sourcePageId,
          target_page_id: r.targetPageId,
          source_block_id: r.sourceBlockId,
          kind: r.kind,
          snippet: r.snippet,
          created_at: r.createdAt.toISOString(),
        })),
        next_cursor: hasMore ? encodeCursor({ skip: pageSize }) : null,
        has_more: hasMore,
        backlink: {},
      });
    });
  });

  // POST /v1/pages/:id/backlinks:reindex — trigger reindex; admin-only-ish (requires can_edit).
  router.post('/:id/backlinks:reindex', async (c) => {
    const id = c.req.param('id');
    const actor = c.get('actor');
    await requirePermission(deps.handle.db, actor, { type: 'page', id }, 'can_edit');
    return withSpan('backlinks', 'backlinks.reindex', { 'page.id': id }, async () => {
      const count = await reindexBacklinksForPage(deps.handle.db, id);
      return c.json({ object: 'backlinks_reindex', source_page_id: id, count });
    });
  });

  return router;
}
