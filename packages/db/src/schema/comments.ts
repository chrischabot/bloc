import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const discussions = pgTable(
  'discussions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    /** `'page' | 'block'`. */
    parentType: text('parent_type').notNull(),
    parentId: uuid('parent_id').notNull(),
    resolved: boolean('resolved').notNull().default(false),
    /** Inline-comment anchor: `{ block_id, start_offset, end_offset }`. */
    anchor: jsonb('anchor'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    parentIdx: index('idx_discussions_parent').on(t.parentType, t.parentId),
  }),
);

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    discussionId: uuid('discussion_id').notNull(),
    parentType: text('parent_type').notNull(),
    parentId: uuid('parent_id').notNull(),
    /** RichText[] */
    richText: jsonb('rich_text').notNull(),
    createdBy: uuid('created_by').notNull(),
    lastEditedBy: uuid('last_edited_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    lastEditedAt: timestamp('last_edited_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    discussionIdx: index('idx_comments_discussion').on(t.discussionId),
  }),
);

export const commentReactions = pgTable(
  'comment_reactions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    commentId: uuid('comment_id').notNull(),
    userId: uuid('user_id').notNull(),
    /** Unicode emoji string (e.g. "👍"). */
    emoji: text('emoji').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    commentIdx: index('idx_comment_reactions_comment').on(t.commentId),
    uniq: uniqueIndex('uniq_comment_reaction').on(t.commentId, t.userId, t.emoji),
  }),
);
