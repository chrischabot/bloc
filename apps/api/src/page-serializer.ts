import type { Page } from '@bloc/db';

export interface SerializedPage {
  object: 'page';
  id: string;
  created_time: string;
  created_by: { object: 'user'; id: string };
  last_edited_time: string;
  last_edited_by: { object: 'user'; id: string };
  archived: boolean;
  in_trash: boolean;
  icon: unknown;
  cover: unknown;
  title: string;
  properties: Record<string, unknown>;
  parent: {
    type: 'workspace' | 'page_id' | 'database_id';
    workspace?: boolean;
    page_id?: string;
    database_id?: string;
    data_source_id?: string;
  };
  url: string;
  public_url: string | null;
}

interface PropertyRowLike {
  id: string;
  name: string;
  type: string;
}
interface PagePropertyRowLike {
  property_id: string;
  value: { type: string; [key: string]: unknown };
}

export function serializePage(
  row: Page,
  args: {
    properties: PropertyRowLike[];
    values: PagePropertyRowLike[];
    /** Optional base URL to compose `url`; defaults to relative. */
    baseUrl?: string;
  },
): SerializedPage {
  const valueById = new Map(args.values.map((v) => [v.property_id, v.value]));
  const properties: Record<string, unknown> = {};
  for (const prop of args.properties) {
    const v = valueById.get(prop.id);
    const serialized = v ?? makeEmptyValue(prop.type);
    properties[prop.name] = {
      id: prop.id,
      type: prop.type,
      ...stampRichText(serialized, prop.type),
    };
  }

  return {
    object: 'page',
    id: row.id,
    created_time: row.createdAt.toISOString(),
    created_by: { object: 'user', id: row.createdBy },
    last_edited_time: row.lastEditedAt.toISOString(),
    last_edited_by: { object: 'user', id: row.lastEditedBy },
    archived: row.archived,
    in_trash: row.inTrash,
    icon: row.icon,
    cover: row.cover,
    title: row.title ?? 'Untitled',
    properties,
    parent: parentRefOf(row),
    url: `${args.baseUrl ?? ''}/${row.id.replace(/-/g, '')}`,
    public_url: row.publicSlug ? `/${row.publicSlug}` : null,
  };
}

function parentRefOf(row: Page): SerializedPage['parent'] {
  if (row.parentType === 'workspace') return { type: 'workspace', workspace: true };
  if (row.parentType === 'page') {
    return { type: 'page_id', page_id: row.parentId ?? '' };
  }
  // database
  const out: SerializedPage['parent'] = {
    type: 'database_id',
    database_id: row.parentId ?? '',
  };
  if (row.dataSourceId !== null && row.dataSourceId !== undefined) {
    out.data_source_id = row.dataSourceId;
  }
  return out;
}

function makeEmptyValue(type: string): Record<string, unknown> {
  switch (type) {
    case 'title':
      return { type, title: [] };
    case 'rich_text':
      return { type, rich_text: [] };
    case 'number':
      return { type, number: null };
    case 'select':
      return { type, select: null };
    case 'multi_select':
      return { type, multi_select: [] };
    case 'status':
      return { type, status: null };
    case 'date':
      return { type, date: null };
    case 'people':
      return { type, people: [] };
    case 'files':
      return { type, files: [] };
    case 'checkbox':
      return { type, checkbox: false };
    case 'url':
      return { type, url: null };
    case 'email':
      return { type, email: null };
    case 'phone_number':
      return { type, phone_number: null };
    case 'relation':
      return { type, relation: [], has_more: false };
    case 'created_time':
      return { type, created_time: '1970-01-01T00:00:00Z' };
    case 'last_edited_time':
      return { type, last_edited_time: '1970-01-01T00:00:00Z' };
    default:
      return { type };
  }
}

function stampRichText(value: Record<string, unknown>, type: string): Record<string, unknown> {
  if (type !== 'title' && type !== 'rich_text') return value;
  const arr = value[type];
  if (!Array.isArray(arr)) return value;
  const stamped = (arr as Array<Record<string, unknown>>).map((node) => {
    if (typeof node !== 'object' || node === null) return node;
    const out = { ...node };
    const text = out['text'] as { content?: string; link?: { url: string } | null } | undefined;
    const equation = out['equation'] as { expression?: string } | undefined;
    let plain = (out['plain_text'] as string | undefined) ?? '';
    if (plain.length === 0) {
      if (text?.content !== undefined) plain = text.content;
      else if (equation?.expression !== undefined) plain = equation.expression;
    }
    out['plain_text'] = plain;
    if ((out['href'] === undefined || out['href'] === null) && text?.link?.url !== undefined) {
      out['href'] = text.link.url;
    }
    return out;
  });
  return { ...value, [type]: stamped };
}
