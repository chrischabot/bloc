export * from './inline.ts';

/** v3 record table names. */
export const V3_TABLES = [
  'block',
  'space',
  'collection',
  'collection_view',
  'notion_user',
  'discussion',
  'comment',
] as const;
export type V3Table = (typeof V3_TABLES)[number];

/** v3 operation command vocabulary. */
export const V3_COMMANDS = ['set', 'update', 'listAfter', 'listBefore', 'listRemove'] as const;
export type V3Command = (typeof V3_COMMANDS)[number];

export interface V3Operation {
  id: string;
  table: V3Table;
  path: string[];
  command: V3Command;
  args: unknown;
}

export interface V3Transaction {
  id?: string;
  spaceId: string;
  operations: V3Operation[];
}

export interface V3RecordMap {
  block?: Record<string, { role: string; value: Record<string, unknown> }>;
  space?: Record<string, { role: string; value: Record<string, unknown> }>;
  collection?: Record<string, { role: string; value: Record<string, unknown> }>;
  collection_view?: Record<string, { role: string; value: Record<string, unknown> }>;
  notion_user?: Record<string, { role: string; value: Record<string, unknown> }>;
  discussion?: Record<string, { role: string; value: Record<string, unknown> }>;
  comment?: Record<string, { role: string; value: Record<string, unknown> }>;
}
