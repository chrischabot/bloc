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

export const pages = pgTable(
  'pages',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull(),
    parentType: text('parent_type').notNull(),
    parentId: uuid('parent_id'),
    dataSourceId: uuid('data_source_id'),
    title: text('title').notNull().default('Untitled'),
    archived: boolean('archived').notNull().default(false),
    inTrash: boolean('in_trash').notNull().default(false),
    isTemplate: boolean('is_template').notNull().default(false),
    isWiki: boolean('is_wiki').notNull().default(false),
    publicSlug: text('public_slug'),
    cover: jsonb('cover'),
    icon: jsonb('icon'),
    /** Wiki verification state: `{ state, verified_by, verified_at, expires_at }` (Phase 16). */
    verification: jsonb('verification'),
    createdBy: uuid('created_by').notNull(),
    lastEditedBy: uuid('last_edited_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    lastEditedAt: timestamp('last_edited_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    workspaceParentIdx: index('idx_pages_workspace_parent').on(t.workspaceId, t.parentId),
    workspaceEditIdx: index('idx_pages_workspace_edit').on(
      t.workspaceId,
      t.archived,
      t.lastEditedAt,
    ),
    dataSourceIdx: index('idx_pages_data_source').on(t.dataSourceId),
  }),
);

export const databases = pgTable('databases', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: uuid('workspace_id').notNull(),
  parentType: text('parent_type').notNull(),
  parentId: uuid('parent_id'),
  title: jsonb('title').notNull().default(sql`'[]'::jsonb`),
  description: jsonb('description').notNull().default(sql`'[]'::jsonb`),
  isInline: boolean('is_inline').notNull().default(false),
  archived: boolean('archived').notNull().default(false),
  inTrash: boolean('in_trash').notNull().default(false),
  cover: jsonb('cover'),
  icon: jsonb('icon'),
  config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
  createdBy: uuid('created_by').notNull(),
  lastEditedBy: uuid('last_edited_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  lastEditedAt: timestamp('last_edited_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
});

export const dataSources = pgTable(
  'data_sources',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    databaseId: uuid('database_id').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull().default('owned'),
    sourceDatabaseId: uuid('source_database_id'),
    sourceDataSourceId: uuid('source_data_source_id'),
    archived: boolean('archived').notNull().default(false),
    position: text('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    dbIdx: index('idx_data_sources_database').on(t.databaseId),
  }),
);

export const databaseProperties = pgTable(
  'database_properties',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    databaseId: uuid('database_id').notNull(),
    dataSourceId: uuid('data_source_id'),
    name: text('name').notNull(),
    type: text('type').notNull(),
    config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
    position: text('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    dbNameIdx: uniqueIndex('uniq_database_property_name').on(t.databaseId, t.name),
    dbIdx: index('idx_database_properties_database').on(t.databaseId),
  }),
);

export const databaseViews = pgTable(
  'database_views',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    databaseId: uuid('database_id').notNull(),
    dataSourceId: uuid('data_source_id'),
    name: text('name').notNull(),
    type: text('type').notNull(),
    filter: jsonb('filter'),
    sort: jsonb('sort'),
    groupBy: jsonb('group_by'),
    visibleProperties: jsonb('visible_properties'),
    config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
    position: text('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    dbIdx: index('idx_database_views_database').on(t.databaseId),
  }),
);
