import {
  type ClientHandle,
  getDatabase,
  getPage,
  listChildren,
  listPageProperties,
  listProperties,
  requirePermission,
} from '@bloc/db';
import { withSpan } from '@bloc/observability';
import { BlocNotFoundError, BlocValidationError } from '@bloc/shared';
import { Hono } from 'hono';
import '../types.ts';
import { exportDatabaseAsCsv } from '../exports/csv.ts';
import { exportPageAsMarkdown } from '../exports/markdown.ts';

interface Deps {
  handle: ClientHandle;
}

async function pageAsJson(deps: Deps, pageId: string): Promise<Record<string, unknown>> {
  const page = await getPage(deps.handle.db, pageId);
  if (page === null) return {};
  const properties =
    page.parentType === 'database' && page.parentId !== null
      ? await listProperties(deps.handle.db, page.parentId)
      : [];
  const values = await listPageProperties(deps.handle.db, pageId);
  const valueById = new Map(values.map((v) => [v.propertyId, v.value as Record<string, unknown>]));
  const propsOut: Record<string, unknown> = {};
  for (const p of properties) {
    propsOut[p.name] = valueById.get(p.id) ?? { type: p.type };
  }
  const children = await listChildren(deps.handle.db, pageId, { limit: 500 });
  return {
    object: 'page',
    id: page.id,
    parent:
      page.parentType === 'workspace'
        ? { type: 'workspace' }
        : { type: page.parentType, id: page.parentId },
    properties: propsOut,
    icon: page.icon,
    cover: page.cover,
    archived: page.archived,
    in_trash: page.inTrash,
    created_time: page.createdAt.toISOString(),
    last_edited_time: page.lastEditedAt.toISOString(),
    children: children.map((c) => ({ id: c.id, type: c.type, content: c.content })),
  };
}

export function createExportsRouter(deps: Deps): Hono {
  const router = new Hono();

  // GET /v1/pages/:id/export?format=markdown|json
  router.get('/:id/export', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const url = new URL(c.req.url);
    const format = (url.searchParams.get('format') ?? 'markdown').toLowerCase();
    if (!['markdown', 'json'].includes(format)) {
      throw new BlocValidationError(
        `Unsupported format '${format}'. Use markdown or json.`,
        requestId,
      );
    }
    return withSpan('exports', `exports.page.${format}`, { 'page.id': id }, async () => {
      await requirePermission(deps.handle.db, actor, { type: 'page', id }, 'can_read');
      const page = await getPage(deps.handle.db, id);
      if (page === null) throw new BlocNotFoundError(`Page ${id} not found`, requestId);
      if (format === 'markdown') {
        const md = await exportPageAsMarkdown(deps.handle, id);
        c.header('content-type', 'text/markdown; charset=utf-8');
        c.header('content-disposition', `attachment; filename="page-${id.slice(0, 8)}.md"`);
        return c.body(md);
      }
      // json
      const payload = await pageAsJson(deps, id);
      c.header('content-type', 'application/json; charset=utf-8');
      c.header('content-disposition', `attachment; filename="page-${id.slice(0, 8)}.json"`);
      return c.body(JSON.stringify(payload, null, 2));
    });
  });

  return router;
}

/** Database export endpoints mounted separately under `/v1/databases`. */
export function createDatabaseExportsRouter(deps: Deps): Hono {
  const router = new Hono();

  router.get('/:id/export', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const url = new URL(c.req.url);
    const format = (url.searchParams.get('format') ?? 'csv').toLowerCase();
    if (!['csv', 'json'].includes(format)) {
      throw new BlocValidationError(
        `Unsupported format '${format}'. Use csv or json.`,
        requestId,
      );
    }
    return withSpan('exports', `exports.database.${format}`, { 'database.id': id }, async () => {
      const db = await getDatabase(deps.handle.db, id);
      if (db === null) throw new BlocNotFoundError(`Database ${id} not found`, requestId);
      await requirePermission(deps.handle.db, actor, { type: 'database', id }, 'can_read');
      if (format === 'csv') {
        const csv = await exportDatabaseAsCsv(deps.handle, id);
        c.header('content-type', 'text/csv; charset=utf-8');
        c.header('content-disposition', `attachment; filename="database-${id.slice(0, 8)}.csv"`);
        return c.body(csv);
      }
      // json
      const properties = await listProperties(deps.handle.db, id);
      c.header('content-type', 'application/json; charset=utf-8');
      c.header('content-disposition', `attachment; filename="database-${id.slice(0, 8)}.json"`);
      return c.body(
        JSON.stringify(
          {
            object: 'database',
            id,
            title: db.title,
            properties: properties.map((p) => ({
              id: p.id,
              name: p.name,
              type: p.type,
              config: p.config,
            })),
          },
          null,
          2,
        ),
      );
    });
  });

  return router;
}
