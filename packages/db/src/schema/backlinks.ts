import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const backlinks = pgTable(
  'backlinks',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    sourcePageId: uuid('source_page_id').notNull(),
    targetPageId: uuid('target_page_id').notNull(),
    /** Nullable: when the backlink comes from a relation property (no block). */
    sourceBlockId: uuid('source_block_id'),
    /** `'mention' | 'link_to_page' | 'relation'`. */
    kind: text('kind').notNull(),
    /** Cached snippet of the linking text (first 200 chars). */
    snippet: text('snippet'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    targetIdx: index('idx_backlinks_target').on(t.targetPageId),
    sourceIdx: index('idx_backlinks_source').on(t.sourcePageId),
  }),
);
