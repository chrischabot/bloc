import type { ClientHandle } from '@bloc/db';
import { schema } from '@bloc/db';
import type { V3RecordMap } from '@bloc/shared';
import { eq, inArray } from 'drizzle-orm';

const READER_ROLE = 'editor';

interface RecordRef {
  table: keyof V3RecordMap;
  id: string;
}

/**
 * Materialise a recordMap for the given record references. Permission filtering
 * is applied by the caller — this helper assumes the actor has read access to
 * everything in `refs`.
 */
export async function buildRecordMap(
  handle: ClientHandle,
  refs: RecordRef[],
): Promise<V3RecordMap> {
  const byTable = new Map<keyof V3RecordMap, string[]>();
  for (const ref of refs) {
    const existing = byTable.get(ref.table) ?? [];
    existing.push(ref.id);
    byTable.set(ref.table, existing);
  }
  const out: V3RecordMap = {};

  const blockIds = byTable.get('block');
  if (blockIds && blockIds.length > 0) {
    const rows = await handle.db
      .select()
      .from(schema.blocks)
      .where(inArray(schema.blocks.id, blockIds));
    const blockMap: Record<string, { role: string; value: Record<string, unknown> }> = {};
    for (const row of rows) {
      blockMap[row.id] = {
        role: READER_ROLE,
        value: {
          id: row.id,
          version: row.version,
          type: row.type,
          parent_id: row.parentId,
          parent_table: row.parentType === 'page' ? 'block' : row.parentType,
          alive: !row.archived,
          properties: extractV3Properties(row.content as Record<string, unknown>, row.type),
          format: {},
          content: [],
          created_by_id: row.createdBy,
          last_edited_by_id: row.lastEditedBy,
          created_time: row.createdAt.getTime(),
          last_edited_time: row.lastEditedAt.getTime(),
          space_id: row.workspaceId,
        },
      };
    }
    // Also populate `content` arrays by querying children.
    if (rows.length > 0) {
      const children = await handle.db
        .select()
        .from(schema.blocks)
        .where(inArray(schema.blocks.parentId, blockIds));
      const childrenById = new Map<string, string[]>();
      for (const child of children) {
        const list = childrenById.get(child.parentId) ?? [];
        list.push(child.id);
        childrenById.set(child.parentId, list);
      }
      for (const id of blockIds) {
        const entry = blockMap[id];
        if (entry !== undefined) {
          entry.value['content'] = childrenById.get(id) ?? [];
        }
      }
    }
    out.block = blockMap;
  }

  const spaceIds = byTable.get('space');
  if (spaceIds && spaceIds.length > 0) {
    const rows = await handle.db
      .select()
      .from(schema.workspaces)
      .where(inArray(schema.workspaces.id, spaceIds));
    const spaceMap: Record<string, { role: string; value: Record<string, unknown> }> = {};
    for (const row of rows) {
      spaceMap[row.id] = {
        role: READER_ROLE,
        value: {
          id: row.id,
          name: row.name,
          icon: row.icon,
          plan: row.plan,
          created_time: row.createdAt.getTime(),
          last_edited_time: row.updatedAt.getTime(),
        },
      };
    }
    out.space = spaceMap;
  }

  const collectionIds = byTable.get('collection');
  if (collectionIds && collectionIds.length > 0) {
    const rows = await handle.db
      .select()
      .from(schema.databases)
      .where(inArray(schema.databases.id, collectionIds));
    const cMap: Record<string, { role: string; value: Record<string, unknown> }> = {};
    for (const row of rows) {
      cMap[row.id] = {
        role: READER_ROLE,
        value: {
          id: row.id,
          name: row.title,
          description: row.description,
          parent_id: row.parentId,
          parent_table: row.parentType,
          alive: !row.archived,
          space_id: row.workspaceId,
        },
      };
    }
    out.collection = cMap;
  }

  const userIds = byTable.get('notion_user');
  if (userIds && userIds.length > 0) {
    const rows = await handle.db
      .select()
      .from(schema.users)
      .where(inArray(schema.users.id, userIds));
    const uMap: Record<string, { role: string; value: Record<string, unknown> }> = {};
    for (const row of rows) {
      uMap[row.id] = {
        role: READER_ROLE,
        value: {
          id: row.id,
          name: row.name,
          email: row.email,
          profile_photo: row.avatarUrl,
        },
      };
    }
    out.notion_user = uMap;
  }

  return out;
}

/** Extract v3-style `properties` map from a block's content jsonb. */
function extractV3Properties(
  content: Record<string, unknown>,
  type: string,
): Record<string, unknown> {
  const payload = (content[type] ?? content) as Record<string, unknown>;
  const props: Record<string, unknown> = {};
  if (Array.isArray(payload['rich_text'])) {
    props['title'] = payload['rich_text'];
  }
  if (Array.isArray(payload['caption'])) {
    props['caption'] = payload['caption'];
  }
  return props;
}

/** Materialise a page's full subtree as a recordMap (block records). */
export async function loadPageChunk(
  handle: ClientHandle,
  pageId: string,
  limit = 100,
): Promise<V3RecordMap> {
  // Collect ids by BFS, capped at `limit`.
  const ids: string[] = [pageId];
  let frontier: string[] = [pageId];
  while (frontier.length > 0 && ids.length < limit) {
    const rows = await handle.db
      .select({ id: schema.blocks.id })
      .from(schema.blocks)
      .where(inArray(schema.blocks.parentId, frontier));
    const next = rows.map((r) => r.id);
    for (const id of next) {
      if (ids.length >= limit) break;
      ids.push(id);
    }
    frontier = next;
  }
  // Also load the page row.
  const [pageRow] = await handle.db
    .select()
    .from(schema.pages)
    .where(eq(schema.pages.id, pageId))
    .limit(1);
  const refs: RecordRef[] = ids.map((id) => ({ table: 'block', id }));
  if (pageRow !== undefined) refs.push({ table: 'space', id: pageRow.workspaceId });
  return buildRecordMap(handle, refs);
}
