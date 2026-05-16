import { sql } from 'drizzle-orm';
import { bigint, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const files = pgTable('files', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: uuid('workspace_id').notNull(),
  uploadedBy: uuid('uploaded_by').notNull(),
  name: text('name').notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  mime: text('mime').notNull(),
  storageKey: text('storage_key').notNull(),
  urlExpiresAt: timestamp('url_expires_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
