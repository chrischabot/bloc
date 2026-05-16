import { type ClientHandle, getDatabase, queryDatabase, schema } from '@bloc/db';
import { withSpan } from '@bloc/observability';
import {
  FilterSchema,
  BlocAuthError,
  BlocNotFoundError,
  BlocValidationError,
  SortArraySchema,
  type V3RecordMap,
  V3_TABLES,
} from '@bloc/shared';
import { eq, inArray } from 'drizzle-orm';
import { type Context, Hono } from 'hono';
import { z } from 'zod';
import { executeOperations } from '../v3/operations.ts';
import { buildRecordMap, loadPageChunk } from '../v3/record-map.ts';
import '../types.ts';

interface Deps {
  handle: ClientHandle;
}

type V3Table = keyof V3RecordMap;

const LoadPageChunkSchema = z
  .object({
    pageId: z.string().uuid(),
    limit: z.number().int().min(1).max(500).default(100),
    cursor: z.unknown().optional(),
    chunkNumber: z.number().int().min(0).optional(),
    verticalColumns: z.boolean().optional(),
  })
  .passthrough();

const GetRecordValuesSchema = z
  .object({
    requests: z
      .array(
        z
          .object({
            table: z.enum(V3_TABLES as readonly string[] as [string, ...string[]]),
            id: z.string().uuid(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();

const SyncRecordValuesSchema = z
  .object({
    requests: z
      .array(
        z
          .object({
            pointer: z
              .object({
                table: z.enum(V3_TABLES as readonly string[] as [string, ...string[]]),
                id: z.string().uuid(),
              })
              .strict(),
            version: z.number().int().min(0),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();

const SubmitTransactionSchema = z
  .object({
    requestId: z.string().uuid().optional(),
    transactions: z
      .array(
        z
          .object({
            id: z.string().uuid().optional(),
            spaceId: z.string().uuid(),
            operations: z
              .array(
                z
                  .object({
                    id: z.string().uuid(),
                    table: z.enum(V3_TABLES as readonly string[] as [string, ...string[]]),
                    path: z.array(z.string()).max(8),
                    command: z.enum(['set', 'update', 'listAfter', 'listBefore', 'listRemove']),
                    args: z.unknown(),
                  })
                  .strict(),
              )
              .min(1)
              .max(500),
          })
          .strict(),
      )
      .min(1)
      .max(10),
  })
  .strict();

const QueryCollectionLoaderSchema = z
  .object({
    type: z.string().default('reducer'),
    limit: z.number().int().min(1).max(500).default(100),
    searchQuery: z.string().max(2000).optional(),
    userTimeZone: z.string().optional(),
    filter: FilterSchema.optional(),
    sort: SortArraySchema.optional(),
  })
  .passthrough();

const QueryCollectionSchema = z
  .object({
    collection: z.object({ id: z.string().uuid(), spaceId: z.string().uuid().optional() }),
    collectionView: z.object({ id: z.string().uuid() }).optional(),
    loader: QueryCollectionLoaderSchema.optional(),
  })
  .passthrough();

export function createInternalV3Router(deps: Deps): Hono {
  const router = new Hono();

  router.post('/loadPageChunk', async (c) => {
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const body = LoadPageChunkSchema.parse(await c.req.json());
    return withSpan('v3', 'v3.loadPageChunk', { 'page.id': body.pageId }, async () => {
      const [page] = await deps.handle.db
        .select()
        .from(schema.pages)
        .where(eq(schema.pages.id, body.pageId))
        .limit(1);
      if (!page) throw new BlocNotFoundError(`Page ${body.pageId} not found`, requestId);
      if (page.workspaceId !== actor.workspaceId) {
        throw new BlocNotFoundError(`Page ${body.pageId} not found`, requestId);
      }
      const recordMap = await loadPageChunk(deps.handle, body.pageId, body.limit);
      return c.json({ recordMap, cursor: { stack: [] } });
    });
  });

  router.post('/getRecordValues', async (c) => {
    const actor = c.get('actor');
    const body = GetRecordValuesSchema.parse(await c.req.json());
    return withSpan(
      'v3',
      'v3.getRecordValues',
      { 'records.count': body.requests.length },
      async () => {
        const refs = body.requests.map((r) => ({ table: r.table as V3Table, id: r.id }));
        const recordMap = await buildRecordMap(deps.handle, refs);
        if (recordMap.block !== undefined) {
          for (const [id, entry] of Object.entries(recordMap.block)) {
            if (entry.value['space_id'] !== actor.workspaceId) {
              delete recordMap.block[id];
            }
          }
        }
        return c.json({
          results: body.requests.map((r) => recordMap[r.table as V3Table]?.[r.id] ?? null),
        });
      },
    );
  });

  router.post('/syncRecordValues', async (c) => {
    const body = SyncRecordValuesSchema.parse(await c.req.json());
    return withSpan(
      'v3',
      'v3.syncRecordValues',
      { 'records.count': body.requests.length },
      async () => {
        const refs = body.requests.map((r) => ({
          table: r.pointer.table as V3Table,
          id: r.pointer.id,
        }));
        const recordMap = await buildRecordMap(deps.handle, refs);
        return c.json({ recordMap });
      },
    );
  });

  router.post('/submitTransaction', async (c) => {
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const body = SubmitTransactionSchema.parse(await c.req.json());
    return withSpan(
      'v3',
      'v3.submitTransaction',
      { 'transactions.count': body.transactions.length },
      async () => {
        let appliedTotal = 0;
        let skippedTotal = 0;
        for (const tx of body.transactions) {
          if (tx.spaceId !== actor.workspaceId) {
            throw new BlocValidationError('spaceId mismatch with actor workspace', requestId);
          }
          const result = await executeOperations(
            deps.handle,
            tx.operations.map((op) => ({
              id: op.id,
              table: op.table as V3Table,
              path: op.path,
              command: op.command,
              args: op.args,
            })),
            actor,
          );
          appliedTotal += result.applied;
          skippedTotal += result.skipped;
        }
        return c.json({
          object: 'transaction_result',
          applied: appliedTotal,
          skipped: skippedTotal,
        });
      },
    );
  });

  router.post('/loadUserContent', async (c) => {
    const actor = c.get('actor');
    const [user] = await deps.handle.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, actor.userId))
      .limit(1);
    if (!user) throw new BlocAuthError('Unknown user', c.get('requestId'));
    const refs: { table: V3Table; id: string }[] = [
      { table: 'notion_user', id: actor.userId },
      { table: 'space', id: actor.workspaceId },
    ];
    const recordMap = await buildRecordMap(deps.handle, refs);
    return c.json({ recordMap });
  });

  async function queryCollection(c: Context): Promise<Response> {
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const body = QueryCollectionSchema.parse(await c.req.json());
    return withSpan(
      'v3',
      'v3.queryCollection',
      { 'collection.id': body.collection.id, 'loader.limit': body.loader?.limit ?? 100 },
      async () => {
        const dbRow = await getDatabase(deps.handle.db, body.collection.id);
        if (dbRow === null) {
          throw new BlocNotFoundError(`Collection ${body.collection.id} not found`, requestId);
        }
        if (dbRow.workspaceId !== actor.workspaceId) {
          // Hide existence: workspace mismatch returns 404 per docs/api/02-errors.md.
          throw new BlocNotFoundError(`Collection ${body.collection.id} not found`, requestId);
        }
        const loader = body.loader;
        const queryArgs: Parameters<typeof queryDatabase>[1] = {
          databaseId: body.collection.id,
          limit: loader?.limit ?? 100,
        };
        if (loader?.filter !== undefined) queryArgs.filter = loader.filter;
        if (loader?.sort !== undefined) {
          queryArgs.sorts = loader.sort as Parameters<typeof queryDatabase>[1]['sorts'];
        }
        const queryResult = await queryDatabase(deps.handle.db, queryArgs);

        const pageIds = queryResult.pageRows.map((r) => r.id);
        const collectionRefs = [{ table: 'collection' as const, id: body.collection.id }];
        const recordMap = await buildRecordMap(deps.handle, collectionRefs);

        // Optional substring searchQuery filter applied against page property values.
        let filteredIds = pageIds;
        const q = loader?.searchQuery?.trim().toLowerCase();
        if (q !== undefined && q.length > 0 && pageIds.length > 0) {
          const propertyRows = await deps.handle.db
            .select()
            .from(schema.pageProperties)
            .where(inArray(schema.pageProperties.pageId, pageIds));
          const byPage = new Map<string, string>();
          for (const row of propertyRows) {
            const prev = byPage.get(row.pageId) ?? '';
            byPage.set(row.pageId, `${prev} ${JSON.stringify(row.value).toLowerCase()}`);
          }
          filteredIds = pageIds.filter((id) => (byPage.get(id) ?? '').includes(q));
        }

        return c.json({
          recordMap,
          result: {
            type: 'table',
            blockIds: filteredIds,
            total: filteredIds.length,
          },
        });
      },
    );
  }

  router.post('/queryCollection', queryCollection);
  router.post('/queryCollectionV2', queryCollection);

  return router;
}
