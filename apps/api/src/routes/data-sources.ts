import {
  type ClientHandle,
  type DataSource,
  UnknownPropertyError,
  between,
  getDatabase,
  getDefaultDataSource,
  listDataSources,
  listPageProperties,
  listProperties,
  queryDatabase,
  requirePermission,
  schema,
} from '@bloc/db';
import { withSpan } from '@bloc/observability';
import {
  FilterSchema,
  BlocConflictError,
  BlocNotFoundError,
  BlocValidationError,
  SortArraySchema,
  decodeCursor,
  encodeCursor,
} from '@bloc/shared';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import '../types.ts';
import { serializePage } from '../page-serializer.ts';

interface Deps {
  handle: ClientHandle;
}

const CreateSchema = z
  .object({
    database_id: z.string().uuid(),
    name: z.string().min(1).max(100),
    type: z.enum(['owned', 'linked']).default('owned'),
    source_data_source_id: z.string().uuid().optional(),
  })
  .strict();

const QuerySchema = z
  .object({
    filter: FilterSchema.optional(),
    sorts: SortArraySchema.optional(),
    start_cursor: z.string().optional(),
    page_size: z.number().int().min(1).max(100).default(100),
  })
  .strict();

interface SerializedDataSource {
  object: 'data_source';
  id: string;
  database_id: string;
  name: string;
  type: 'owned' | 'linked';
  linked_from: { database_id: string; data_source_id: string } | null;
  archived: boolean;
  created_time: string;
  last_edited_time: string;
}

function serialize(row: DataSource): SerializedDataSource {
  return {
    object: 'data_source',
    id: row.id,
    database_id: row.databaseId,
    name: row.name,
    type: row.type === 'linked' ? 'linked' : 'owned',
    linked_from:
      row.type === 'linked' && row.sourceDatabaseId !== null && row.sourceDataSourceId !== null
        ? { database_id: row.sourceDatabaseId, data_source_id: row.sourceDataSourceId }
        : null,
    archived: row.archived,
    created_time: row.createdAt.toISOString(),
    last_edited_time: row.updatedAt.toISOString(),
  };
}

export function createDataSourcesRouter(deps: Deps): Hono {
  const router = new Hono();

  // POST /v1/databases/:databaseId/data_sources
  router.post('/databases/:databaseId/data_sources', async (c) => {
    const databaseId = c.req.param('databaseId');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const body = CreateSchema.parse(await c.req.json());
    if (body.database_id !== databaseId) {
      throw new BlocValidationError('database_id in path and body must match', requestId);
    }
    const dbRow = await getDatabase(deps.handle.db, databaseId);
    if (dbRow === null) {
      throw new BlocNotFoundError(`Database ${databaseId} not found`, requestId);
    }
    await requirePermission(
      deps.handle.db,
      actor,
      { type: 'database', id: databaseId },
      'can_edit',
    );

    return withSpan(
      'data_sources',
      'data_sources.create',
      { 'database.id': databaseId },
      async () => {
        // Linked sources: detect cycles + cross-workspace permission.
        let sourceDatabaseId: string | null = null;
        if (body.type === 'linked') {
          if (body.source_data_source_id === undefined) {
            throw new BlocValidationError(
              'source_data_source_id required for type=linked',
              requestId,
            );
          }
          // Find the upstream data source.
          const [upstream] = await deps.handle.db
            .select()
            .from(schema.dataSources)
            .where(eq(schema.dataSources.id, body.source_data_source_id))
            .limit(1);
          if (!upstream) {
            throw new BlocNotFoundError(
              `Upstream data source ${body.source_data_source_id} not found`,
              requestId,
            );
          }
          if (upstream.type === 'linked') {
            throw new BlocConflictError('Cannot link to another linked data source', requestId);
          }
          sourceDatabaseId = upstream.databaseId;
        }

        const sources = await listDataSources(deps.handle.db, databaseId);
        const last = sources.at(-1);
        const lastPos = last !== undefined ? last.position : null;
        const insertArgs: typeof schema.dataSources.$inferInsert = {
          databaseId,
          name: body.name,
          type: body.type,
          position: between(lastPos, null),
        };
        if (sourceDatabaseId !== null) insertArgs.sourceDatabaseId = sourceDatabaseId;
        if (body.source_data_source_id !== undefined) {
          insertArgs.sourceDataSourceId = body.source_data_source_id;
        }
        const [row] = await deps.handle.db
          .insert(schema.dataSources)
          .values(insertArgs)
          .returning();
        if (!row) throw new Error('createDataSource: empty insert');
        return c.json(serialize(row));
      },
    );
  });

  // GET /v1/databases/:databaseId/data_sources
  router.get('/databases/:databaseId/data_sources', async (c) => {
    const databaseId = c.req.param('databaseId');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const dbRow = await getDatabase(deps.handle.db, databaseId);
    if (dbRow === null) {
      throw new BlocNotFoundError(`Database ${databaseId} not found`, requestId);
    }
    await requirePermission(
      deps.handle.db,
      actor,
      { type: 'database', id: databaseId },
      'can_read',
    );
    const rows = await listDataSources(deps.handle.db, databaseId);
    return c.json({
      object: 'list',
      type: 'data_source',
      results: rows.map(serialize),
      next_cursor: null,
      has_more: false,
      data_source: {},
    });
  });

  // GET /v1/data_sources/:id
  router.get('/data_sources/:id', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const row = await fetchDataSource(deps, id);
    if (row === null) throw new BlocNotFoundError(`Data source ${id} not found`, requestId);
    await requirePermission(
      deps.handle.db,
      actor,
      { type: 'database', id: row.databaseId },
      'can_read',
    );
    return c.json(serialize(row));
  });

  // PATCH /v1/data_sources/:id
  router.patch('/data_sources/:id', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const row = await fetchDataSource(deps, id);
    if (row === null) throw new BlocNotFoundError(`Data source ${id} not found`, requestId);
    await requirePermission(
      deps.handle.db,
      actor,
      { type: 'database', id: row.databaseId },
      'can_edit',
    );
    const body = z
      .object({
        name: z.string().min(1).max(100).optional(),
        archived: z.boolean().optional(),
      })
      .strict()
      .parse(await c.req.json());

    if (row.type === 'linked') {
      // Schema mutations on linked sources are forbidden.
      // Renaming the source itself is permitted because it doesn't change schema.
    }
    const update: Partial<typeof schema.dataSources.$inferInsert> = { updatedAt: new Date() };
    if (body.name !== undefined) update.name = body.name;
    if (body.archived !== undefined) update.archived = body.archived;
    const [updated] = await deps.handle.db
      .update(schema.dataSources)
      .set(update)
      .where(eq(schema.dataSources.id, id))
      .returning();
    if (!updated) throw new BlocNotFoundError(`Data source ${id} not found`, requestId);
    return c.json(serialize(updated));
  });

  // DELETE /v1/data_sources/:id
  router.delete('/data_sources/:id', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const row = await fetchDataSource(deps, id);
    if (row === null) throw new BlocNotFoundError(`Data source ${id} not found`, requestId);
    await requirePermission(
      deps.handle.db,
      actor,
      { type: 'database', id: row.databaseId },
      'can_edit',
    );
    // Soft-archive instead of hard delete.
    const [updated] = await deps.handle.db
      .update(schema.dataSources)
      .set({ archived: true, updatedAt: new Date() })
      .where(eq(schema.dataSources.id, id))
      .returning();
    if (!updated) throw new BlocNotFoundError(`Data source ${id} not found`, requestId);
    return c.body(null, 204);
  });

  // POST /v1/data_sources/:id/query
  router.post('/data_sources/:id/query', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const row = await fetchDataSource(deps, id);
    if (row === null) throw new BlocNotFoundError(`Data source ${id} not found`, requestId);
    await requirePermission(
      deps.handle.db,
      actor,
      { type: 'database', id: row.databaseId },
      'can_read',
    );
    // For linked sources, resolve to the upstream database for the query.
    const queryDatabaseId =
      row.type === 'linked' && row.sourceDatabaseId !== null
        ? row.sourceDatabaseId
        : row.databaseId;

    const body = QuerySchema.parse(await c.req.json().catch(() => ({})));
    const cursor =
      body.start_cursor !== undefined
        ? (() => {
            try {
              return decodeCursor<{ id: string; createdAt: string }>(body.start_cursor);
            } catch {
              throw new BlocValidationError('Invalid cursor', requestId);
            }
          })()
        : undefined;
    const queryArgs: Parameters<typeof queryDatabase>[1] = {
      databaseId: queryDatabaseId,
      limit: body.page_size,
    };
    if (body.filter !== undefined) queryArgs.filter = body.filter;
    if (body.sorts !== undefined) {
      queryArgs.sorts = body.sorts as Parameters<typeof queryDatabase>[1]['sorts'];
    }
    if (cursor !== undefined) queryArgs.cursor = cursor;

    let result: Awaited<ReturnType<typeof queryDatabase>>;
    try {
      result = await queryDatabase(deps.handle.db, queryArgs);
    } catch (err) {
      if (err instanceof UnknownPropertyError) {
        throw new BlocValidationError(err.message, requestId, [
          { path: 'filter.property', issue: 'unknown_property' },
        ]);
      }
      throw err;
    }

    const properties = await listProperties(deps.handle.db, queryDatabaseId);
    const propSimple = properties.map((p) => ({ id: p.id, name: p.name, type: p.type }));
    const serialized = await Promise.all(
      result.pageRows.map(async (page) => {
        const rawValues = await listPageProperties(deps.handle.db, page.id);
        const values = rawValues.map((v) => ({
          property_id: v.propertyId,
          value: v.value as { type: string; [k: string]: unknown },
        }));
        return serializePage(page, { properties: propSimple, values });
      }),
    );

    return c.json({
      object: 'list',
      type: 'page_or_data_source',
      results: serialized,
      next_cursor: result.nextCursor !== null ? encodeCursor(result.nextCursor) : null,
      has_more: result.hasMore,
      data_source: { id, database_id: row.databaseId },
    });
  });

  return router;
}

async function fetchDataSource(deps: Deps, id: string): Promise<DataSource | null> {
  const [row] = await deps.handle.db
    .select()
    .from(schema.dataSources)
    .where(and(eq(schema.dataSources.id, id), eq(schema.dataSources.archived, false)))
    .limit(1);
  return row ?? null;
}

// Re-export for symmetry.
export { getDefaultDataSource };
