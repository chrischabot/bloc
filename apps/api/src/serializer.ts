import type { Block } from '@bloc/db';
import { type BlockType, type RichText, derivePlainText, isBlockType } from '@bloc/shared';

/** The serialised public-API block object. */
export interface SerializedBlock {
  object: 'block';
  id: string;
  parent: {
    type: 'page_id' | 'block_id' | 'database_id' | 'workspace';
    page_id?: string;
    block_id?: string;
    database_id?: string;
    workspace?: boolean;
  };
  created_time: string;
  created_by: { object: 'user'; id: string };
  last_edited_time: string;
  last_edited_by: { object: 'user'; id: string };
  archived: boolean;
  in_trash: boolean;
  has_children: boolean;
  type: BlockType;
  [key: string]: unknown;
}

function withPlainText(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...payload };
  // Walk known rich-text fields and stamp plain_text + href on each node.
  for (const key of ['rich_text', 'caption'] as const) {
    const arr = out[key];
    if (Array.isArray(arr)) {
      out[key] = arr.map((node) => stampNode(node as RichText));
    }
  }
  // Table-row cells are RichText[][].
  if (Array.isArray(out['cells'])) {
    out['cells'] = (out['cells'] as RichText[][]).map((cell) => cell.map(stampNode));
  }
  return out;
}

function stampNode(node: RichText): RichText {
  return {
    ...node,
    plain_text: node.plain_text ?? derivePlainText(node),
    href: node.href ?? null,
  };
}

/** Map an internal block row to the public-API serialized object. */
export function serializeBlock(row: Block): SerializedBlock {
  if (!isBlockType(row.type)) {
    throw new Error(`serializeBlock: unsupported type ${row.type}`);
  }
  const type: BlockType = row.type;
  const content = (row.content ?? {}) as Record<string, unknown>;
  // Block payload may live under content[type] OR be the content itself depending
  // on how it was stored. Normalise to `payload`.
  const payload =
    type in content && typeof (content as Record<string, unknown>)[type] === 'object'
      ? ((content as Record<string, unknown>)[type] as Record<string, unknown>)
      : content;
  const stamped = withPlainText(payload);
  const out: SerializedBlock = {
    object: 'block',
    id: row.id,
    parent: parentRefOf(row),
    created_time: row.createdAt.toISOString(),
    created_by: { object: 'user', id: row.createdBy },
    last_edited_time: row.lastEditedAt.toISOString(),
    last_edited_by: { object: 'user', id: row.lastEditedBy },
    archived: row.archived,
    in_trash: row.archived,
    has_children: row.hasChildren,
    type,
    [type]: stamped,
  };
  return out;
}

function parentRefOf(row: Block): SerializedBlock['parent'] {
  switch (row.parentType) {
    case 'page':
      return { type: 'page_id', page_id: row.parentId };
    case 'block':
      return { type: 'block_id', block_id: row.parentId };
    case 'database':
      return { type: 'database_id', database_id: row.parentId };
    default:
      return { type: 'workspace', workspace: true };
  }
}
