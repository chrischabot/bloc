import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const reminders = pgTable(
  'reminders',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull(),
    /** Where the reminder lives: a page or a block id. */
    parentType: text('parent_type').notNull(),
    parentId: uuid('parent_id').notNull(),
    /** The user the reminder fires for. */
    userId: uuid('user_id').notNull(),
    /** When to fire. */
    dueAt: timestamp('due_at', { withTimezone: true, mode: 'date' }).notNull(),
    /** Optional human-readable label / mention snippet. */
    label: text('label'),
    /** Set to true when the runner fires the reminder. */
    fired: boolean('fired').notNull().default(false),
    /** When the reminder actually fired, if it did. */
    firedAt: timestamp('fired_at', { withTimezone: true, mode: 'date' }),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceUserIdx: index('idx_reminders_user_due').on(t.userId, t.dueAt),
    dueIdx: index('idx_reminders_due').on(t.dueAt),
  }),
);
