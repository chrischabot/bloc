import {
  type ClientHandle,
  UnknownPropertyError,
  createDatabase,
  createProperty,
  getDatabase,
  getPage,
  listPageProperties,
  listProperties,
  queryDatabase,
  requirePermission,
} from '@bloc/db';
import { withSpan } from '@bloc/observability';
import {
  FilterSchema,
  BlocNotFoundError,
  BlocValidationError,
  PROPERTY_TYPES,
  type PropertyType,
  RichTextArraySchema,
  SortArraySchema,
  decodeCursor,
  encodeCursor,
  isPropertyType,
} from '@bloc/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import '../types.ts';
import { serializeDatabase } from '../database-serializer.ts';
import { serializePage } from '../page-serializer.ts';
import { type Emitter, makeEmitter } from '../webhooks/emit.ts';

interface Deps {
  handle: ClientHandle;
  emit?: Emitter;
}

const PropertyDefinitionSchema = z
  .object({
    type: z.enum(PROPERTY_TYPES as [PropertyType, ...PropertyType[]]),
  })
  .passthrough();

const CreateDatabaseSchema = z
  .object({
    parent: z.object({
      type: z.enum(['page_id', 'workspace']),
      page_id: z.string().uuid().optional(),
      workspace: z.literal(true).optional(),
    }),
    title: RichTextArraySchema.default([]),
    description: RichTextArraySchema.default([]),
    icon: z.unknown().optional(),
    cover: z.unknown().optional(),
    is_inline: z.boolean().default(false),
    properties: z.record(z.string(), PropertyDefinitionSchema),
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

export function createDatabasesRouter(deps: Deps): Hono {
  const router = new Hono();
  const emit = deps.emit ?? makeEmitter(deps.handle);

  // POST /v1/databases
  router.post('/', async (c) => {
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const body = CreateDatabaseSchema.parse(await c.req.json());
    return withSpan('databases', 'databases.create', {}, async () => {
      // Validate parent.
      let parentType: 'workspace' | 'page';
      let parentId: string | null = null;
      if (body.parent.type === 'workspace') {
        parentType = 'workspace';
      } else {
        if (body.parent.page_id === undefined) {
          throw new BlocValidationError('parent.page_id required', requestId);
        }
        parentType = 'page';
        parentId = body.parent.page_id;
        const p = await getPage(deps.handle.db, parentId);
        if (p === null)
          throw new BlocNotFoundError(`Parent page ${parentId} not found`, requestId);
      }

      // Exactly one title property required.
      const propEntries = Object.entries(body.properties);
      const titleCount = propEntries.filter(([, def]) => def.type === 'title').length;
      if (titleCount !== 1) {
        throw new BlocValidationError(
          `Database must have exactly one 'title' property (found ${titleCount})`,
          requestId,
        );
      }

      const dbArgs: Parameters<typeof createDatabase>[1] = {
        workspaceId: actor.workspaceId,
        parentType,
        title: body.title,
        description: body.description,
        isInline: body.is_inline,
        createdBy: actor.userId,
        lastEditedBy: actor.userId,
      };
      if (parentId !== null) dbArgs.parentId = parentId;
      if (body.icon !== undefined) dbArgs.icon = body.icon as Record<string, unknown>;
      if (body.cover !== undefined) dbArgs.cover = body.cover as Record<string, unknown>;
      const row = await createDatabase(deps.handle.db, dbArgs);

      // Create properties.
      for (const [name, def] of propEntries) {
        const t = def.type as PropertyType;
        const cfg = (def as Record<string, unknown>)[t] ?? {};
        await createProperty(deps.handle.db, {
          databaseId: row.id,
          name,
          type: t,
          config: cfg,
        });
      }

      const properties = await listProperties(deps.handle.db, row.id);
      void emit({
        workspaceId: actor.workspaceId,
        type: 'database.created',
        data: { database_id: row.id },
      });
      return c.json(serializeDatabase(row, properties));
    });
  });

  // GET /v1/databases/:id
  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    return withSpan('databases', 'databases.retrieve', { 'database.id': id }, async () => {
      const row = await getDatabase(deps.handle.db, id);
      if (row === null) throw new BlocNotFoundError(`Database ${id} not found`, requestId);
      await requirePermission(deps.handle.db, actor, { type: 'database', id }, 'can_read');
      const properties = await listProperties(deps.handle.db, id);
      return c.json(serializeDatabase(row, properties));
    });
  });

  // PATCH /v1/databases/:id
  router.patch('/:id', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const body = z
      .object({
        title: RichTextArraySchema.optional(),
        description: RichTextArraySchema.optional(),
        icon: z.unknown().optional(),
        cover: z.unknown().optional(),
        archived: z.boolean().optional(),
        properties: z.record(z.string(), PropertyDefinitionSchema.or(z.null())).optional(),
      })
      .strict()
      .parse(await c.req.json());

    return withSpan('databases', 'databases.update', { 'database.id': id }, async () => {
      const existing = await getDatabase(deps.handle.db, id);
      if (existing === null) throw new BlocNotFoundError(`Database ${id} not found`, requestId);
      await requirePermission(deps.handle.db, actor, { type: 'database', id }, 'can_edit');

      // Add new properties (renames / removals beyond v1 scope).
      if (body.properties) {
        const current = await listProperties(deps.handle.db, id);
        const byName = new Map(current.map((p) => [p.name, p]));
        for (const [name, def] of Object.entries(body.properties)) {
          if (def === null) {
            // Removal not yet supported.
            throw new BlocValidationError(
              `Removing property '${name}' requires PATCH support in a future phase`,
              requestId,
            );
          }
          if (!byName.has(name)) {
            if (!isPropertyType(def.type)) {
              throw new BlocValidationError(
                `Unknown property type '${def.type}' for '${name}'`,
                requestId,
              );
            }
            const cfg = (def as Record<string, unknown>)[def.type] ?? {};
            await createProperty(deps.handle.db, {
              databaseId: id,
              name,
              type: def.type,
              config: cfg,
            });
          }
        }
      }

      const fresh = await getDatabase(deps.handle.db, id);
      if (fresh === null) throw new BlocNotFoundError(`Database ${id} not found`, requestId);
      const properties = await listProperties(deps.handle.db, id);
      void emit({
        workspaceId: actor.workspaceId,
        type: 'database.updated',
        data: { database_id: id },
      });
      return c.json(serializeDatabase(fresh, properties));
    });
  });

  // POST /v1/databases/:id/query
  router.post('/:id/query', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const body = QuerySchema.parse(await c.req.json().catch(() => ({})));
    return withSpan('databases', 'databases.query', { 'database.id': id }, async () => {
      const dbRow = await getDatabase(deps.handle.db, id);
      if (dbRow === null) throw new BlocNotFoundError(`Database ${id} not found`, requestId);
      await requirePermission(deps.handle.db, actor, { type: 'database', id }, 'can_read');

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
        databaseId: id,
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

      const properties = await listProperties(deps.handle.db, id);
      const propSimple = properties.map((p) => ({ id: p.id, name: p.name, type: p.type }));

      const serialized = await Promise.all(
        result.pageRows.map(async (row) => {
          const rawValues = await listPageProperties(deps.handle.db, row.id);
          const values = rawValues.map((v) => ({
            property_id: v.propertyId,
            value: v.value as { type: string; [k: string]: unknown },
          }));
          return serializePage(row, { properties: propSimple, values });
        }),
      );

      return c.json({
        object: 'list',
        type: 'page_or_database',
        results: serialized,
        next_cursor: result.nextCursor !== null ? encodeCursor(result.nextCursor) : null,
        has_more: result.hasMore,
        page_or_database: {},
      });
    });
  });

  return router;
}
