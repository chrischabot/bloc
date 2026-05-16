import {
  type ClientHandle,
  appendChildren,
  archiveBlock,
  getBlock,
  listChildren,
  requirePermission,
  updateBlock,
} from '@bloc/db';
import { withSpan } from '@bloc/observability';
import {
  AnyBlockInputSchema,
  type BlockType,
  BlocNotFoundError,
  decodeCursor,
  encodeCursor,
  isBlockType,
} from '@bloc/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import '../types.ts';
import { reindexBacklinksAsync } from '../backlinks/reindex.ts';
import { realtimeBus } from '../realtime/bus.ts';
import { serializeBlock } from '../serializer.ts';
import { type Emitter, makeEmitter } from '../webhooks/emit.ts';

interface Deps {
  handle: ClientHandle;
  emit?: Emitter;
}

const ChildrenAppendSchema = z
  .object({
    children: z.array(AnyBlockInputSchema).min(1).max(100),
    after: z.string().uuid().optional(),
  })
  .strict();

const UpdateBlockSchema = z.object({ archived: z.boolean().optional() }).passthrough();

/** Decode a paginated children cursor (encodes the last position seen). */
function decodeChildrenCursor(cursor: string | undefined): string | undefined {
  if (cursor === undefined) return undefined;
  try {
    const payload = decodeCursor<{ position: string }>(cursor);
    return payload.position;
  } catch {
    throw new BlocNotFoundError('Invalid cursor', '');
  }
}

export function createBlocksRouter(deps: Deps): Hono {
  const router = new Hono();
  const emit = deps.emit ?? makeEmitter(deps.handle);

  // GET /v1/blocks/:id
  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    return withSpan('blocks', 'blocks.retrieve', { 'block.id': id }, async () => {
      const row = await getBlock(deps.handle.db, id);
      if (!row || row.archived) throw new BlocNotFoundError(`Block ${id} not found`, requestId);
      await requirePermission(
        deps.handle.db,
        actor,
        { type: 'page', id: row.parentType === 'page' ? row.parentId : row.workspaceId },
        'can_read',
      );
      return c.json(serializeBlock(row));
    });
  });

  // GET /v1/blocks/:id/children
  router.get('/:id/children', async (c) => {
    const id = c.req.param('id');
    const url = new URL(c.req.url);
    const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get('page_size') ?? 100)));
    const startCursor = url.searchParams.get('start_cursor') ?? undefined;
    const startPosition = decodeChildrenCursor(startCursor);
    return withSpan(
      'blocks',
      'blocks.children.list',
      { 'block.id': id, 'page.size': pageSize },
      async () => {
        const childrenArgs: Parameters<typeof listChildren>[2] = { limit: pageSize + 1 };
        if (startPosition !== undefined) childrenArgs.startPosition = startPosition;
        const all = await listChildren(deps.handle.db, id, childrenArgs);
        const hasMore = all.length > pageSize;
        const win = hasMore ? all.slice(0, pageSize) : all;
        const last = win.at(-1);
        const nextCursor =
          hasMore && last !== undefined ? encodeCursor({ position: last.position }) : null;
        return c.json({
          object: 'list',
          type: 'block',
          results: win.map(serializeBlock),
          next_cursor: nextCursor,
          has_more: hasMore,
          block: {},
        });
      },
    );
  });

  // PATCH /v1/blocks/:id/children
  router.patch('/:id/children', async (c) => {
    const id = c.req.param('id');
    const actor = c.get('actor');
    const body = ChildrenAppendSchema.parse(await c.req.json());
    return withSpan(
      'blocks',
      'blocks.children.append',
      { 'block.id': id, 'block.children_count': body.children.length },
      async () => {
        const parent = await getBlockOrPageRoot(deps, id);
        await requirePermission(
          deps.handle.db,
          actor,
          { type: 'page', id: parent.pageId },
          'can_edit',
        );
        const childrenInput = body.children.map((c2) => {
          const blockObj = c2 as { type: BlockType } & Record<string, unknown>;
          const payload = blockObj[blockObj.type];
          return {
            type: blockObj.type,
            content: { [blockObj.type]: payload } as Record<string, unknown>,
          };
        });
        const appendArgs: Parameters<typeof appendChildren>[1] = {
          workspaceId: parent.workspaceId,
          parentId: id,
          parentType: parent.parentTypeForChildren,
          actor: actor.userId,
          children: childrenInput,
        };
        if (body.after !== undefined) appendArgs.afterId = body.after;
        const inserted = await appendChildren(deps.handle.db, appendArgs);
        for (const blk of inserted) {
          realtimeBus.publish({
            type: 'block.appended',
            pageId: parent.pageId,
            workspaceId: parent.workspaceId,
            data: { block_id: blk.id, parent_id: id, type: blk.type },
          });
        }
        void emit({
          workspaceId: parent.workspaceId,
          type: 'block.appended',
          data: { parent_id: id, count: inserted.length },
        });
        reindexBacklinksAsync(deps.handle, parent.pageId);
        return c.json({
          object: 'list',
          type: 'block',
          results: inserted.map(serializeBlock),
          next_cursor: null,
          has_more: false,
        });
      },
    );
  });

  // PATCH /v1/blocks/:id
  router.patch('/:id', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const body = UpdateBlockSchema.parse(await c.req.json());
    return withSpan('blocks', 'blocks.update', { 'block.id': id }, async () => {
      const existing = await getBlock(deps.handle.db, id);
      if (!existing) throw new BlocNotFoundError(`Block ${id} not found`, requestId);
      const ancestor = await getBlockOrPageRoot(deps, id);
      await requirePermission(
        deps.handle.db,
        actor,
        { type: 'page', id: ancestor.pageId },
        'can_edit',
      );
      const t = existing.type;
      if (!isBlockType(t)) throw new BlocNotFoundError(`Block ${id} has unknown type`, requestId);
      let content: Record<string, unknown> | undefined;
      const typeKey = t;
      if (typeKey in body) {
        const candidate = { type: typeKey, [typeKey]: (body as Record<string, unknown>)[typeKey] };
        AnyBlockInputSchema.parse(candidate);
        content = { [typeKey]: (body as Record<string, unknown>)[typeKey] };
      }
      const updateArgs: Parameters<typeof updateBlock>[2] = { actor: actor.userId };
      if (content !== undefined) updateArgs.content = content;
      if (typeof body['archived'] === 'boolean') updateArgs.archived = body['archived'];
      const next = await updateBlock(deps.handle.db, id, updateArgs);
      if (!next) throw new BlocNotFoundError(`Block ${id} not found`, requestId);
      realtimeBus.publish({
        type: 'block.updated',
        pageId: ancestor.pageId,
        workspaceId: existing.workspaceId,
        data: { block_id: id, type: existing.type, archived: next.archived },
      });
      void emit({
        workspaceId: existing.workspaceId,
        type: 'block.updated',
        data: { block_id: id, type: existing.type },
      });
      reindexBacklinksAsync(deps.handle, ancestor.pageId);
      return c.json(serializeBlock(next));
    });
  });

  // DELETE /v1/blocks/:id
  router.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    return withSpan('blocks', 'blocks.delete', { 'block.id': id }, async () => {
      const existing = await getBlock(deps.handle.db, id);
      if (!existing) throw new BlocNotFoundError(`Block ${id} not found`, requestId);
      const ancestor = await getBlockOrPageRoot(deps, id);
      await requirePermission(
        deps.handle.db,
        actor,
        { type: 'page', id: ancestor.pageId },
        'can_edit',
      );
      const archived = await archiveBlock(deps.handle.db, id, actor.userId);
      if (!archived) throw new BlocNotFoundError(`Block ${id} not found`, requestId);
      realtimeBus.publish({
        type: 'block.deleted',
        pageId: ancestor.pageId,
        workspaceId: existing.workspaceId,
        data: { block_id: id, type: existing.type },
      });
      void emit({
        workspaceId: existing.workspaceId,
        type: 'block.deleted',
        data: { block_id: id, type: existing.type },
      });
      reindexBacklinksAsync(deps.handle, ancestor.pageId);
      return c.json(serializeBlock(archived));
    });
  });

  return router;
}

/** For ACL resolution: find the page-id ancestor + workspace-id of a block. */
async function getBlockOrPageRoot(
  deps: Deps,
  id: string,
): Promise<{
  pageId: string;
  workspaceId: string;
  parentTypeForChildren: 'page' | 'block' | 'database';
}> {
  const row = await getBlock(deps.handle.db, id);
  if (row === null) {
    // Treat id as a page id: look up the page's workspace + parent type.
    const { getPage } = await import('@bloc/db');
    const page = await getPage(deps.handle.db, id);
    if (page === null) {
      throw new BlocNotFoundError(`Block or page ${id} not found`, '');
    }
    return {
      pageId: page.id,
      workspaceId: page.workspaceId,
      parentTypeForChildren: 'page',
    };
  }
  let pageId = row.parentType === 'page' ? row.parentId : row.id;
  let cursor = row;
  let safety = 0;
  while (cursor.parentType === 'block' && safety < 50) {
    const parent = await getBlock(deps.handle.db, cursor.parentId);
    if (parent === null) break;
    cursor = parent;
    if (cursor.parentType === 'page') pageId = cursor.parentId;
    safety += 1;
  }
  return {
    pageId,
    workspaceId: row.workspaceId,
    parentTypeForChildren: 'block',
  };
}
