import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Uint8Array; default: false }>({
  dataType() {
    return 'bytea';
  },
});

export const blocks = pgTable(
  'blocks',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull(),
    /** `'page' | 'block' | 'database'`. */
    parentType: text('parent_type').notNull(),
    parentId: uuid('parent_id').notNull(),
    /** Fractional index for sibling order. */
    position: text('position').notNull(),
    /** One of the documented block types — see api/schemas/block-types.md. */
    type: text('type').notNull(),
    /** Type-specific payload. */
    content: jsonb('content').notNull().default(sql`'{}'::jsonb`),
    hasChildren: boolean('has_children').notNull().default(false),
    archived: boolean('archived').notNull().default(false),
    /** Per-record version for v3 last-writer-wins. */
    version: integer('version').notNull().default(0),
    createdBy: uuid('created_by').notNull(),
    lastEditedBy: uuid('last_edited_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    lastEditedAt: timestamp('last_edited_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    parentPosIdx: index('idx_blocks_parent').on(t.parentId, t.position),
    workspaceTypeIdx: index('idx_blocks_workspace_type').on(t.workspaceId, t.type, t.lastEditedAt),
  }),
);

/** Append-only Yjs update log (per `docs/architecture/05-realtime-architecture.md#persistence`). */
export const blockUpdates = pgTable(
  'block_updates',
  {
    pageId: uuid('page_id').notNull(),
    clock: bigint('clock', { mode: 'number' }).notNull(),
    update: bytea('update').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    pageClockIdx: index('idx_block_updates_page_clock').on(t.pageId, t.clock),
  }),
);
