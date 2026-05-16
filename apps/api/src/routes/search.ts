import { type ClientHandle, resolveLevel, schema } from '@bloc/db';
import { withSpan } from '@bloc/observability';
import { encodeCursor } from '@bloc/shared';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import '../types.ts';
import { serializePage } from '../page-serializer.ts';

interface Deps {
  handle: ClientHandle;
}

const SearchSchema = z
  .object({
    query: z.string().max(2000).optional(),
    sort: z
      .object({
        direction: z.enum(['ascending', 'descending']),
        timestamp: z.literal('last_edited_time'),
      })
      .optional(),
    filter: z
      .object({
        value: z.enum(['page', 'database']),
        property: z.literal('object'),
      })
      .optional(),
    start_cursor: z.string().optional(),
    page_size: z.number().int().min(1).max(100).default(100),
  })
  .strict();

export function createSearchRouter(deps: Deps): Hono {
  const router = new Hono();

  router.post('/', async (c) => {
    const actor = c.get('actor');
    const body = SearchSchema.parse(await c.req.json().catch(() => ({})));
    return withSpan(
      'search',
      'search',
      { 'query.length': body.query?.length ?? 0, 'filter.value': body.filter?.value ?? 'any' },
      async () => {
        const pagesTable = schema.pages;
        const blocksTable = schema.blocks;
        const direction = body.sort?.direction === 'ascending' ? 'asc' : 'desc';
        const limit = body.page_size + 1;

        // 1) Page titles via the title-block of each page (the first heading_1 / paragraph) OR
        //    via the title property value on database-row pages.
        const wantPage = !body.filter || body.filter.value === 'page';
        const wantDatabase = !body.filter || body.filter.value === 'database';
        const q = body.query ?? '';
        const pattern = `%${q}%`;

        const pageRows = wantPage
          ? await deps.handle.db
              .select()
              .from(pagesTable)
              .where(
                and(eq(pagesTable.workspaceId, actor.workspaceId), eq(pagesTable.archived, false)),
              )
              .orderBy(
                direction === 'asc' ? pagesTable.lastEditedAt : desc(pagesTable.lastEditedAt),
              )
              .limit(limit * 5)
          : [];

        // For each candidate page, check if its first block contains the query (cheap).
        const filteredPages =
          q.length === 0
            ? pageRows
            : (
                await Promise.all(
                  pageRows.map(async (row) => {
                    const titleBlocks = await deps.handle.db
                      .select()
                      .from(blocksTable)
                      .where(
                        and(
                          eq(blocksTable.parentId, row.id),
                          ilike(sql`${blocksTable.content}::text`, pattern),
                        ),
                      )
                      .limit(1);
                    return titleBlocks.length > 0 ? row : null;
                  }),
                )
              ).filter((r): r is NonNullable<typeof r> => r !== null);

        // Permission filter: drop pages the actor can't read.
        const visiblePages = (
          await Promise.all(
            filteredPages.map(async (row) => {
              const lvl = await resolveLevel(deps.handle.db, actor, { type: 'page', id: row.id });
              if (lvl === 'no_access') return null;
              return row;
            }),
          )
        ).filter((r): r is NonNullable<typeof r> => r !== null);

        const results: unknown[] = visiblePages
          .slice(0, body.page_size)
          .map((row) => serializePage(row, { properties: [], values: [] }));

        // Database results (when wantDatabase=true): just title-substring match on databases.title jsonb.
        if (wantDatabase) {
          const dbRows = await deps.handle.db
            .select()
            .from(schema.databases)
            .where(
              and(
                eq(schema.databases.workspaceId, actor.workspaceId),
                eq(schema.databases.archived, false),
                q.length === 0 ? sql`true` : ilike(sql`${schema.databases.title}::text`, pattern),
              ),
            )
            .limit(body.page_size);
          for (const row of dbRows) {
            results.push({
              object: 'database',
              id: row.id,
              title: row.title,
              description: row.description,
              created_time: row.createdAt.toISOString(),
              last_edited_time: row.lastEditedAt.toISOString(),
              archived: row.archived,
              in_trash: row.inTrash,
              is_inline: row.isInline,
            });
          }
        }

        const window = results.slice(0, body.page_size);
        const hasMore = results.length > body.page_size;
        return c.json({
          object: 'list',
          type: 'page_or_database',
          results: window,
          next_cursor: hasMore ? encodeCursor({ offset: body.page_size }) : null,
          has_more: hasMore,
          page_or_database: {},
        });
      },
    );
  });

  return router;
}
