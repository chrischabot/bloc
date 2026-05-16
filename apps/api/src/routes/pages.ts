import {
  type ClientHandle,
  appendChildren,
  archivePage,
  createPage,
  extractRelationRefs,
  getDatabase,
  getDefaultDataSource,
  getPage,
  getPageProperty,
  listPageProperties,
  listProperties,
  permanentDeletePage,
  requirePermission,
  setPageProperty,
  syncDualRelation,
  updatePage,
} from '@bloc/db';
import { withSpan } from '@bloc/observability';
import {
  AnyBlockInputSchema,
  BlocNotFoundError,
  BlocValidationError,
  PROPERTY_VALUE_PAYLOADS,
  PagePropertiesInputSchema,
  type PropertyType,
  isPropertyType,
  isReadonlyPropertyType,
} from '@bloc/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { reindexBacklinksAsync } from '../backlinks/reindex.ts';
import { type Emitter, makeEmitter } from '../webhooks/emit.ts';
import '../types.ts';
import { serializePage } from '../page-serializer.ts';

interface Deps {
  handle: ClientHandle;
  emit?: Emitter;
}

const IconSchema = z.union([
  z.object({ type: z.literal('emoji'), emoji: z.string() }),
  z.object({ type: z.literal('external'), external: z.object({ url: z.string() }) }),
  z.object({
    type: z.literal('file'),
    file: z.object({ url: z.string(), expiry_time: z.string() }),
  }),
]);

const ParentInputSchema = z.union([
  z.object({ type: z.literal('workspace'), workspace: z.literal(true) }),
  z.object({ type: z.literal('page_id'), page_id: z.string().uuid() }),
  z.object({ type: z.literal('database_id'), database_id: z.string().uuid() }),
  z.object({ type: z.literal('data_source_id'), data_source_id: z.string().uuid() }),
]);

const CreatePageSchema = z
  .object({
    parent: ParentInputSchema,
    properties: PagePropertiesInputSchema.default({}),
    icon: IconSchema.nullable().default(null),
    cover: IconSchema.nullable().default(null),
    title: z.string().max(500).optional(),
    children: z.array(AnyBlockInputSchema).max(100).default([]),
  })
  .strict();

const UpdatePageSchema = z
  .object({
    properties: PagePropertiesInputSchema.optional(),
    icon: IconSchema.nullable().optional(),
    cover: IconSchema.nullable().optional(),
    title: z.string().max(500).optional(),
    archived: z.boolean().optional(),
  })
  .strict();

interface PropertyDef {
  id: string;
  name: string;
  type: string;
  config: unknown;
}

/**
 * Write a property value to a page, including dual_property relation
 * inverse-side propagation. Reads the current value first so we can compute
 * the added/removed ref diff before calling syncDualRelation.
 *
 * Note: the syncDualRelation call below passes `sourcePageId` (NOT `pageId`)
 * and the full `sourcePropertyDef` object (NOT `propertyId`), matching the
 * exported `SyncDualRelationArgs` interface in
 * packages/db/src/repositories/relations.ts.
 */
async function writePageProperty(
  deps: Deps,
  args: {
    pageId: string;
    def: PropertyDef;
    newValue: { type: string; [key: string]: unknown };
  },
): Promise<void> {
  let oldRefs: string[] = [];
  if (args.def.type === 'relation') {
    const previous = await getPageProperty(deps.handle.db, {
      pageId: args.pageId,
      propertyId: args.def.id,
    });
    oldRefs = extractRelationRefs(previous?.value);
  }
  await setPageProperty(deps.handle.db, {
    pageId: args.pageId,
    propertyId: args.def.id,
    value: args.newValue,
  });
  if (args.def.type === 'relation') {
    const newRefs = extractRelationRefs(args.newValue);
    await syncDualRelation(deps.handle.db, {
      sourcePageId: args.pageId,
      sourcePropertyDef: {
        id: args.def.id,
        type: args.def.type,
        config: (args.def.config ?? null) as Record<string, unknown> | null,
      },
      oldRefs,
      newRefs,
    });
  }
}

export function createPagesRouter(deps: Deps): Hono {
  const router = new Hono();
  const emit = deps.emit ?? makeEmitter(deps.handle);

  // POST /v1/pages
  router.post('/', async (c) => {
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const body = CreatePageSchema.parse(await c.req.json());
    return withSpan('pages', 'pages.create', { 'parent.type': body.parent.type }, async () => {
      let parentType: 'workspace' | 'page' | 'database';
      let parentId: string | null = null;
      let dataSourceId: string | null = null;
      if (body.parent.type === 'workspace') {
        parentType = 'workspace';
      } else if (body.parent.type === 'page_id') {
        parentType = 'page';
        parentId = body.parent.page_id;
        const parentPage = await getPage(deps.handle.db, parentId);
        if (parentPage === null) {
          throw new BlocNotFoundError(`Parent page ${parentId} not found`, requestId);
        }
        await requirePermission(deps.handle.db, actor, { type: 'page', id: parentId }, 'can_edit');
      } else if (body.parent.type === 'database_id') {
        parentType = 'database';
        parentId = body.parent.database_id;
        const db = await getDatabase(deps.handle.db, parentId);
        if (db === null) {
          throw new BlocNotFoundError(`Database ${parentId} not found`, requestId);
        }
        const def = await getDefaultDataSource(deps.handle.db, parentId);
        if (def !== null) dataSourceId = def.id;
      } else {
        throw new BlocValidationError(
          'data_source_id parent is supported from Phase 4',
          requestId,
        );
      }

      if (parentType === 'database' && parentId !== null) {
        const props = await listProperties(deps.handle.db, parentId);
        const titleProp = props.find((p) => p.type === 'title');
        if (titleProp !== undefined) {
          const titleInBody = Object.entries(body.properties).find(
            ([key]) => key === titleProp.name || key === titleProp.id,
          )?.[1];
          if (titleInBody === undefined) {
            throw new BlocValidationError(
              `Required title property '${titleProp.name}' missing`,
              requestId,
            );
          }
        }
      }

      const createArgs: Parameters<typeof createPage>[1] = {
        workspaceId: actor.workspaceId,
        parentType,
        createdBy: actor.userId,
        lastEditedBy: actor.userId,
      };
      if (parentId !== null) createArgs.parentId = parentId;
      if (dataSourceId !== null) createArgs.dataSourceId = dataSourceId;
      if (body.icon !== null) createArgs.icon = body.icon;
      if (body.cover !== null) createArgs.cover = body.cover;
      if (body.title !== undefined) createArgs.title = body.title;
      const page = await createPage(deps.handle.db, createArgs);

      if (parentType === 'database' && parentId !== null) {
        const props = await listProperties(deps.handle.db, parentId);
        const byName = new Map(props.map((p) => [p.name, p]));
        const byId = new Map(props.map((p) => [p.id, p]));
        for (const [key, raw] of Object.entries(body.properties)) {
          const def = byName.get(key) ?? byId.get(key);
          if (def === undefined) {
            throw new BlocValidationError(`Unknown property '${key}' on database`, requestId, [
              { path: `properties.${key}`, issue: 'unknown_property' },
            ]);
          }
          if (!isPropertyType(def.type)) continue;
          if (isReadonlyPropertyType(def.type as PropertyType)) {
            throw new BlocValidationError(
              `Cannot set read-only property '${key}' (${def.type})`,
              requestId,
            );
          }
          const valueSchema = PROPERTY_VALUE_PAYLOADS[def.type as PropertyType];
          const parsed = valueSchema.safeParse(raw);
          if (!parsed.success) {
            throw new BlocValidationError(
              `Invalid value for property '${key}'`,
              requestId,
              parsed.error.issues.map((iss) => ({
                path: `properties.${key}.${iss.path.join('.')}`,
                issue: iss.message,
              })),
            );
          }
          await writePageProperty(deps, {
            pageId: page.id,
            def: { id: def.id, name: def.name, type: def.type, config: def.config },
            newValue: { type: def.type, ...(parsed.data as Record<string, unknown>) },
          });
        }
      }

      if (body.children.length > 0) {
        const childrenInput = body.children.map((c2) => {
          const obj = c2 as { type: string } & Record<string, unknown>;
          return {
            type: obj.type,
            content: { [obj.type]: obj[obj.type] } as Record<string, unknown>,
          };
        });
        await appendChildren(deps.handle.db, {
          workspaceId: actor.workspaceId,
          parentType: 'page',
          parentId: page.id,
          actor: actor.userId,
          children: childrenInput,
        });
      }

      const fresh = await loadPageWithProperties(deps, page.id);
      if (fresh === null) throw new BlocNotFoundError(`Page ${page.id} not found`, requestId);
      void emit({
        workspaceId: actor.workspaceId,
        type: 'page.created',
        data: { page_id: page.id, parent_type: parentType },
      });
      reindexBacklinksAsync(deps.handle, page.id);
      return c.json(
        serializePage(fresh.row, { properties: fresh.properties, values: fresh.values }),
      );
    });
  });

  // GET /v1/pages/:id
  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    return withSpan('pages', 'pages.retrieve', { 'page.id': id }, async () => {
      await requirePermission(deps.handle.db, actor, { type: 'page', id }, 'can_read');
      const loaded = await loadPageWithProperties(deps, id);
      if (loaded === null) throw new BlocNotFoundError(`Page ${id} not found`, requestId);
      return c.json(
        serializePage(loaded.row, { properties: loaded.properties, values: loaded.values }),
      );
    });
  });

  // PATCH /v1/pages/:id
  router.patch('/:id', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const body = UpdatePageSchema.parse(await c.req.json());
    return withSpan('pages', 'pages.update', { 'page.id': id }, async () => {
      const existing = await getPage(deps.handle.db, id);
      if (existing === null) throw new BlocNotFoundError(`Page ${id} not found`, requestId);
      await requirePermission(deps.handle.db, actor, { type: 'page', id }, 'can_edit');

      if (
        body.properties !== undefined &&
        existing.parentType === 'database' &&
        existing.parentId !== null
      ) {
        const props = await listProperties(deps.handle.db, existing.parentId);
        const byName = new Map(props.map((p) => [p.name, p]));
        const byId = new Map(props.map((p) => [p.id, p]));
        for (const [key, raw] of Object.entries(body.properties)) {
          const def = byName.get(key) ?? byId.get(key);
          if (def === undefined) {
            throw new BlocValidationError(`Unknown property '${key}' on database`, requestId, [
              { path: `properties.${key}`, issue: 'unknown_property' },
            ]);
          }
          if (!isPropertyType(def.type)) continue;
          if (isReadonlyPropertyType(def.type as PropertyType)) {
            throw new BlocValidationError(
              `Cannot set read-only property '${key}' (${def.type})`,
              requestId,
            );
          }
          const valueSchema = PROPERTY_VALUE_PAYLOADS[def.type as PropertyType];
          const parsed = valueSchema.safeParse(raw);
          if (!parsed.success) {
            throw new BlocValidationError(
              `Invalid value for property '${key}'`,
              requestId,
              parsed.error.issues.map((iss) => ({
                path: `properties.${key}.${iss.path.join('.')}`,
                issue: iss.message,
              })),
            );
          }
          await writePageProperty(deps, {
            pageId: id,
            def: { id: def.id, name: def.name, type: def.type, config: def.config },
            newValue: { type: def.type, ...(parsed.data as Record<string, unknown>) },
          });
        }
      }

      const updateArgs: Partial<Parameters<typeof updatePage>[2]> = {
        lastEditedBy: actor.userId,
      };
      if (body.icon !== undefined) updateArgs.icon = body.icon;
      if (body.cover !== undefined) updateArgs.cover = body.cover;
      if (body.title !== undefined) updateArgs.title = body.title;
      let archiveTransition: 'archived' | 'unarchived' | null = null;
      if (body.archived === true && !existing.archived) {
        await archivePage(deps.handle.db, id, actor.userId);
        archiveTransition = 'archived';
      } else {
        if (body.archived === false && existing.archived) {
          archiveTransition = 'unarchived';
          updateArgs.archived = false;
          updateArgs.inTrash = false;
        }
        if (Object.keys(updateArgs).length > 1) {
          await updatePage(deps.handle.db, id, updateArgs);
        }
      }

      const fresh = await loadPageWithProperties(deps, id);
      if (fresh === null) throw new BlocNotFoundError(`Page ${id} not found`, requestId);

      if (archiveTransition === 'archived') {
        void emit({
          workspaceId: actor.workspaceId,
          type: 'page.archived',
          data: { page_id: id },
        });
      } else if (archiveTransition === 'unarchived') {
        void emit({
          workspaceId: actor.workspaceId,
          type: 'page.unarchived',
          data: { page_id: id },
        });
      } else {
        void emit({
          workspaceId: actor.workspaceId,
          type: 'page.updated',
          data: { page_id: id },
        });
      }

      if (body.properties !== undefined || archiveTransition === 'unarchived') {
        reindexBacklinksAsync(deps.handle, id);
      }

      return c.json(
        serializePage(fresh.row, { properties: fresh.properties, values: fresh.values }),
      );
    });
  });

  // DELETE /v1/pages/:id — soft-archive by default; ?permanent=true hard-deletes.
  router.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const url = new URL(c.req.url);
    const permanent = url.searchParams.get('permanent') === 'true';
    return withSpan(
      'pages',
      permanent ? 'pages.permanent_delete' : 'pages.archive',
      { 'page.id': id, permanent },
      async () => {
        const existing = await getPage(deps.handle.db, id);
        if (existing === null) throw new BlocNotFoundError(`Page ${id} not found`, requestId);
        await requirePermission(deps.handle.db, actor, { type: 'page', id }, 'full_access');

        if (permanent) {
          if (!existing.archived) {
            throw new BlocValidationError(
              'Pages must be archived before they can be permanently deleted',
              requestId,
            );
          }
          const removed = await permanentDeletePage(deps.handle.db, id);
          if (!removed) throw new BlocNotFoundError(`Page ${id} not found`, requestId);
          void emit({
            workspaceId: actor.workspaceId,
            type: 'page.deleted',
            data: { page_id: id },
          });
          return c.body(null, 204);
        }
        await archivePage(deps.handle.db, id, actor.userId);
        const fresh = await loadPageWithProperties(deps, id);
        if (fresh === null) throw new BlocNotFoundError(`Page ${id} not found`, requestId);
        void emit({
          workspaceId: actor.workspaceId,
          type: 'page.archived',
          data: { page_id: id },
        });
        return c.json(
          serializePage(fresh.row, { properties: fresh.properties, values: fresh.values }),
        );
      },
    );
  });

  // GET /v1/pages/:id/properties/:property_id
  router.get('/:id/properties/:propertyId', async (c) => {
    const id = c.req.param('id');
    const propertyId = c.req.param('propertyId');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    return withSpan(
      'pages',
      'pages.properties.retrieve',
      { 'page.id': id, 'property.id': propertyId },
      async () => {
        await requirePermission(deps.handle.db, actor, { type: 'page', id }, 'can_read');
        const loaded = await loadPageWithProperties(deps, id);
        if (loaded === null) throw new BlocNotFoundError(`Page ${id} not found`, requestId);
        const prop = loaded.properties.find((p) => p.id === propertyId);
        if (prop === undefined) {
          throw new BlocNotFoundError(`Property ${propertyId} not found`, requestId);
        }
        const value = loaded.values.find((v) => v.property_id === propertyId);
        const payload = value?.value ?? { type: prop.type };
        const { type: _ignored, ...rest } = payload;
        return c.json({
          object: 'property_item',
          id: prop.id,
          type: prop.type,
          ...rest,
        });
      },
    );
  });

  return router;
}

async function loadPageWithProperties(
  deps: Deps,
  id: string,
): Promise<{
  row: NonNullable<Awaited<ReturnType<typeof getPage>>>;
  properties: { id: string; name: string; type: string }[];
  values: { property_id: string; value: { type: string; [key: string]: unknown } }[];
} | null> {
  const row = await getPage(deps.handle.db, id);
  if (row === null) return null;
  let properties: { id: string; name: string; type: string }[] = [];
  if (row.parentType === 'database' && row.parentId !== null) {
    const all = await listProperties(deps.handle.db, row.parentId);
    properties = all.map((p) => ({ id: p.id, name: p.name, type: p.type }));
  }
  const rawValues = await listPageProperties(deps.handle.db, id);
  const values = rawValues.map((v) => ({
    property_id: v.propertyId,
    value: v.value as { type: string; [key: string]: unknown },
  }));
  return { row, properties, values };
}
