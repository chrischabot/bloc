import { type ClientHandle, getPage, requirePermission } from '@bloc/db';
import { withSpan } from '@bloc/observability';
import { BlocNotFoundError, encodeCursor } from '@bloc/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { type RealtimeEvent, realtimeBus } from '../realtime/bus.ts';
import '../types.ts';

interface Deps {
  handle: ClientHandle;
}

const QuerySchema = z.object({
  since: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const WaitSchema = z
  .object({
    since: z.number().int().min(0),
    timeout_ms: z.number().int().min(50).max(25_000).default(10_000),
  })
  .strict();

function lastSeq(events: RealtimeEvent[], fallback: number): number {
  const last = events.at(-1);
  return last !== undefined ? last.seq : fallback;
}

export function createRealtimeRouter(deps: Deps): Hono {
  const router = new Hono();

  router.get('/pages/:id', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const url = new URL(c.req.url);
    const parsed = QuerySchema.parse(Object.fromEntries(url.searchParams));
    return withSpan('realtime', 'realtime.poll', { 'page.id': id }, async () => {
      const page = await getPage(deps.handle.db, id);
      if (page === null) throw new BlocNotFoundError(`Page ${id} not found`, requestId);
      await requirePermission(deps.handle.db, actor, { type: 'page', id }, 'can_read');
      const events = realtimeBus.since(id, parsed.since, parsed.limit);
      const cursorSeq = lastSeq(events, parsed.since);
      return c.json({
        object: 'list',
        type: 'realtime_event',
        results: events,
        next_cursor: events.length === parsed.limit ? encodeCursor({ since: cursorSeq }) : null,
        has_more: events.length === parsed.limit,
        cursor: { since: cursorSeq },
      });
    });
  });

  router.post('/pages/:id/wait', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const body = WaitSchema.parse(await c.req.json());
    const page = await getPage(deps.handle.db, id);
    if (page === null) throw new BlocNotFoundError(`Page ${id} not found`, requestId);
    await requirePermission(deps.handle.db, actor, { type: 'page', id }, 'can_read');

    return withSpan(
      'realtime',
      'realtime.wait',
      { 'page.id': id, 'wait.timeout_ms': body.timeout_ms },
      async () => {
        const immediate = realtimeBus.since(id, body.since);
        if (immediate.length > 0) {
          return c.json({
            object: 'realtime_wait',
            results: immediate,
            cursor: { since: lastSeq(immediate, body.since) },
          });
        }
        const events: RealtimeEvent[] = [];
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            unsub();
            resolve();
          }, body.timeout_ms);
          const unsub = realtimeBus.subscribe(id, (e) => {
            events.push(e);
            clearTimeout(timer);
            unsub();
            resolve();
          });
        });
        return c.json({
          object: 'realtime_wait',
          results: events,
          cursor: { since: lastSeq(events, body.since) },
        });
      },
    );
  });

  return router;
}
