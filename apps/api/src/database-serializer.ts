import type { DatabaseProperty, DatabaseRow } from '@bloc/db';

export interface SerializedDatabase {
  object: 'database';
  id: string;
  created_time: string;
  last_edited_time: string;
  created_by: { object: 'user'; id: string };
  last_edited_by: { object: 'user'; id: string };
  title: unknown;
  description: unknown;
  icon: unknown;
  cover: unknown;
  properties: Record<string, SerializedProperty>;
  parent: {
    type: 'workspace' | 'page_id';
    workspace?: boolean;
    page_id?: string;
  };
  url: string;
  archived: boolean;
  in_trash: boolean;
  is_inline: boolean;
  public_url: string | null;
}

interface SerializedProperty {
  id: string;
  name: string;
  type: string;
  [key: string]: unknown;
}

export function serializeDatabase(
  row: DatabaseRow,
  properties: DatabaseProperty[],
): SerializedDatabase {
  const props: Record<string, SerializedProperty> = {};
  for (const p of properties) {
    props[p.name] = {
      id: p.id,
      name: p.name,
      type: p.type,
      [p.type]: p.config ?? {},
    };
  }
  return {
    object: 'database',
    id: row.id,
    created_time: row.createdAt.toISOString(),
    last_edited_time: row.lastEditedAt.toISOString(),
    created_by: { object: 'user', id: row.createdBy },
    last_edited_by: { object: 'user', id: row.lastEditedBy },
    title: row.title,
    description: row.description,
    icon: row.icon,
    cover: row.cover,
    properties: props,
    parent:
      row.parentType === 'workspace'
        ? { type: 'workspace', workspace: true }
        : { type: 'page_id', page_id: row.parentId ?? '' },
    url: `/${row.id.replace(/-/g, '')}`,
    archived: row.archived,
    in_trash: row.inTrash,
    is_inline: row.isInline,
    public_url: null,
  };
}
