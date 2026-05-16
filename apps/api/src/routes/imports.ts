import {
  type ClientHandle,
  appendChildren,
  createDatabase,
  createPage,
  createProperty,
  getPage,
  requirePermission,
  setPageProperty,
} from '@bloc/db';
import { withSpan } from '@bloc/observability';
import { BlocNotFoundError, BlocValidationError } from '@bloc/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import '../types.ts';
import { parseCsv } from '../imports/csv.ts';
import { parseMarkdown } from '../imports/markdown.ts';
import { type Emitter, makeEmitter } from '../webhooks/emit.ts';

interface Deps {
  handle: ClientHandle;
  emit?: Emitter;
}

const WorkspaceOrPageParent = z.union([
  z.object({ type: z.literal('workspace'), workspace: z.literal(true) }),
  z.object({ type: z.literal('page_id'), page_id: z.string().uuid() }),
]);

const MarkdownImportSchema = z
  .object({
    parent: WorkspaceOrPageParent,
    title: z.string().max(200).default('Imported document'),
    markdown: z.string().min(1).max(1_048_576),
    icon: z.object({}).passthrough().optional(),
  })
  .strict();

const CsvImportSchema = z
  .object({
    parent: WorkspaceOrPageParent,
    title: z.string().max(200).default('Imported database'),
    csv: z.string().min(1).max(10_485_760),
  })
  .strict();

export function createImportsRouter(deps: Deps): Hono {
  const router = new Hono();
  const emit = deps.emit ?? makeEmitter(deps.handle);

  router.post('/markdown', async (c) => {
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const body = MarkdownImportSchema.parse(await c.req.json());
    return withSpan('imports', 'imports.markdown', {}, async () => {
      let parentType: 'workspace' | 'page';
      let parentId: string | null = null;
      if (body.parent.type === 'workspace') {
        parentType = 'workspace';
      } else {
        parentType = 'page';
        parentId = body.parent.page_id;
        const parentPage = await getPage(deps.handle.db, parentId);
        if (parentPage === null) {
          throw new BlocNotFoundError(`Parent page ${parentId} not found`, requestId);
        }
        await requirePermission(deps.handle.db, actor, { type: 'page', id: parentId }, 'can_edit');
      }

      const blocks = parseMarkdown(body.markdown);
      const createArgs: Parameters<typeof createPage>[1] = {
        workspaceId: actor.workspaceId,
        parentType,
        createdBy: actor.userId,
        lastEditedBy: actor.userId,
      };
      if (parentId !== null) createArgs.parentId = parentId;
      if (body.icon !== undefined) createArgs.icon = body.icon as Record<string, unknown>;
      const page = await createPage(deps.handle.db, createArgs);

      // Append blocks in chunks of 100.
      for (let i = 0; i < blocks.length; i += 100) {
        const chunk = blocks.slice(i, i + 100);
        await appendChildren(deps.handle.db, {
          workspaceId: actor.workspaceId,
          parentType: 'page',
          parentId: page.id,
          actor: actor.userId,
          children: chunk.map((b) => ({
            type: b.type,
            content: { [b.type]: (b as Record<string, unknown>)[b.type] } as Record<
              string,
              unknown
            >,
          })),
        });
      }

      void emit({
        workspaceId: actor.workspaceId,
        type: 'page.created',
        data: { page_id: page.id, source: 'import.markdown', blocks: blocks.length },
      });

      return c.json({
        object: 'import_result',
        page_id: page.id,
        blocks_imported: blocks.length,
      });
    });
  });

  router.post('/csv', async (c) => {
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const body = CsvImportSchema.parse(await c.req.json());
    return withSpan('imports', 'imports.csv', {}, async () => {
      let parentType: 'workspace' | 'page';
      let parentId: string | null = null;
      if (body.parent.type === 'workspace') {
        parentType = 'workspace';
      } else {
        parentType = 'page';
        parentId = body.parent.page_id;
        const parentPage = await getPage(deps.handle.db, parentId);
        if (parentPage === null) {
          throw new BlocNotFoundError(`Parent page ${parentId} not found`, requestId);
        }
        await requirePermission(deps.handle.db, actor, { type: 'page', id: parentId }, 'can_edit');
      }

      const parsed = parseCsv(body.csv);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        throw new BlocValidationError(
          'CSV must contain at least a header row and one data row',
          requestId,
        );
      }
      // Create the database with title = first column, rich_text for the rest.
      const dbArgs: Parameters<typeof createDatabase>[1] = {
        workspaceId: actor.workspaceId,
        parentType,
        title: [
          {
            type: 'text',
            text: { content: body.title, link: null },
            plain_text: body.title,
            href: null,
            annotations: {
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              color: 'default',
            },
          },
        ],
        description: [],
        createdBy: actor.userId,
        lastEditedBy: actor.userId,
      };
      if (parentId !== null) dbArgs.parentId = parentId;
      const dbRow = await createDatabase(deps.handle.db, dbArgs);

      const propRecords = [];
      for (let i = 0; i < parsed.headers.length; i++) {
        const name = parsed.headers[i] ?? `Column ${i + 1}`;
        const type = i === 0 ? 'title' : 'rich_text';
        propRecords.push(
          await createProperty(deps.handle.db, {
            databaseId: dbRow.id,
            name,
            type,
          }),
        );
      }

      // Create rows.
      for (const row of parsed.rows) {
        const page = await createPage(deps.handle.db, {
          workspaceId: actor.workspaceId,
          parentType: 'database',
          parentId: dbRow.id,
          createdBy: actor.userId,
          lastEditedBy: actor.userId,
        });
        for (let i = 0; i < propRecords.length; i++) {
          const prop = propRecords[i];
          if (prop === undefined) continue;
          const text = row[parsed.headers[i] ?? ''] ?? '';
          await setPageProperty(deps.handle.db, {
            pageId: page.id,
            propertyId: prop.id,
            value:
              prop.type === 'title'
                ? {
                    type: 'title',
                    title: [
                      {
                        type: 'text',
                        text: { content: text, link: null },
                        plain_text: text,
                        href: null,
                        annotations: {
                          bold: false,
                          italic: false,
                          strikethrough: false,
                          underline: false,
                          code: false,
                          color: 'default',
                        },
                      },
                    ],
                  }
                : {
                    type: 'rich_text',
                    rich_text: [
                      {
                        type: 'text',
                        text: { content: text, link: null },
                        plain_text: text,
                        href: null,
                        annotations: {
                          bold: false,
                          italic: false,
                          strikethrough: false,
                          underline: false,
                          code: false,
                          color: 'default',
                        },
                      },
                    ],
                  },
          });
        }
      }

      void emit({
        workspaceId: actor.workspaceId,
        type: 'database.created',
        data: {
          database_id: dbRow.id,
          source: 'import.csv',
          rows: parsed.rows.length,
          columns: parsed.headers.length,
        },
      });

      return c.json({
        object: 'import_result',
        database_id: dbRow.id,
        rows_imported: parsed.rows.length,
        columns: parsed.headers.length,
      });
    });
  });

  return router;
}
