import { type ClientHandle, getPage, requirePermission, schema } from '@bloc/db';
import { withSpan } from '@bloc/observability';
import { BlocNotFoundError, decodeCursor, encodeCursor } from '@bloc/shared';
import { and, desc, eq, lt, lte } from 'drizzle-orm';
import { Hono } from 'hono';
import '../types.ts';
import { buildRecordMap } from '../v3/record-map.ts';

interface Deps {
  handle: ClientHandle;
}

interface SerializedVersion {
  object: 'page_version';
  page_id: string;
  clock: number;
  created_at: string;
  update_bytes: number;
}

export function createVersionsRouter(deps: Deps): Hono {
  const router = new Hono();

  router.get('/:id/versions', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const page = await getPage(deps.handle.db, id);
    if (page === null) throw new BlocNotFoundError(`Page ${id} not found`, requestId);
    await requirePermission(deps.handle.db, actor, { type: 'page', id }, 'can_read');

    const url = new URL(c.req.url);
    const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get('page_size') ?? 50)));
    const startCursor = url.searchParams.get('start_cursor') ?? undefined;
    let beforeClock: number | undefined;
    if (startCursor !== undefined) {
      try {
        const decoded = decodeCursor<{ clock: number }>(startCursor);
        beforeClock = decoded.clock;
      } catch {
        throw new BlocNotFoundError('Invalid cursor', requestId);
      }
    }

    return withSpan('versions', 'versions.list', { 'page.id': id }, async () => {
      const conditions = [eq(schema.blockUpdates.pageId, id)];
      if (beforeClock !== undefined) {
        conditions.push(lt(schema.blockUpdates.clock, beforeClock));
      }
      const rows = await deps.handle.db
        .select({
          clock: schema.blockUpdates.clock,
          createdAt: schema.blockUpdates.createdAt,
          update: schema.blockUpdates.update,
        })
        .from(schema.blockUpdates)
        .where(and(...conditions))
        .orderBy(desc(schema.blockUpdates.clock))
        .limit(pageSize + 1);
      const hasMore = rows.length > pageSize;
      const window = hasMore ? rows.slice(0, pageSize) : rows;
      const results: SerializedVersion[] = window.map((r) => ({
        object: 'page_version',
        page_id: id,
        clock: r.clock,
        created_at: r.createdAt.toISOString(),
        update_bytes: r.update?.byteLength ?? 0,
      }));
      const last = window.at(-1);
      return c.json({
        object: 'list',
        type: 'page_version',
        results,
        next_cursor: hasMore && last ? encodeCursor({ clock: last.clock }) : null,
        has_more: hasMore,
        page_version: {},
      });
    });
  });

  router.get('/:id/versions/:clock', async (c) => {
    const id = c.req.param('id');
    const clockStr = c.req.param('clock');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const clock = Number(clockStr);
    if (!Number.isInteger(clock)) {
      throw new BlocNotFoundError(`Version ${clockStr} not found`, requestId);
    }
    await requirePermission(deps.handle.db, actor, { type: 'page', id }, 'can_read');

    const [row] = await deps.handle.db
      .select()
      .from(schema.blockUpdates)
      .where(and(eq(schema.blockUpdates.pageId, id), eq(schema.blockUpdates.clock, clock)))
      .limit(1);
    if (!row) throw new BlocNotFoundError(`Version ${clock} not found`, requestId);

    return withSpan(
      'versions',
      'versions.retrieve',
      { 'page.id': id, 'version.clock': clock },
      async () => {
        const blocks = await deps.handle.db
          .select({ id: schema.blocks.id })
          .from(schema.blocks)
          .where(eq(schema.blocks.parentId, id));
        const blockRefs = blocks.map((b) => ({ table: 'block' as const, id: b.id }));
        const recordMap = await buildRecordMap(deps.handle, blockRefs);
        const updatesAtOrBefore = await deps.handle.db
          .select({ clock: schema.blockUpdates.clock })
          .from(schema.blockUpdates)
          .where(and(eq(schema.blockUpdates.pageId, id), lte(schema.blockUpdates.clock, clock)));

        return c.json({
          object: 'page_version_snapshot',
          page_id: id,
          clock: row.clock,
          created_at: row.createdAt.toISOString(),
          update_bytes: row.update?.byteLength ?? 0,
          updates_through_clock: updatesAtOrBefore.length,
          recordMap,
          notes: [
            'Snapshot reflects current relational state with the requested clock metadata.',
            'Yjs-driven point-in-time replay ships with the realtime gateway in v1.1.',
          ],
        });
      },
    );
  });

  return router;
}
