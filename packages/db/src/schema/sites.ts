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

export const publications = pgTable(
  'publications',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    pageId: uuid('page_id').notNull(),
    state: text('state').notNull().default('draft'),
    /** notion.site slug or path under a custom domain. */
    slug: text('slug').notNull(),
    customDomainId: uuid('custom_domain_id'),
    allowEdit: boolean('allow_edit').notNull().default(false),
    allowComment: boolean('allow_comment').notNull().default(true),
    allowDuplicate: boolean('allow_duplicate').notNull().default(false),
    indexInSearch: boolean('index_in_search').notNull().default(true),
    showToc: boolean('show_toc').notNull().default(true),
    showNavbar: boolean('show_navbar').notNull().default(true),
    passwordHash: text('password_hash'),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    pageIdx: uniqueIndex('uniq_publications_page').on(t.pageId),
    slugIdx: index('idx_publications_slug').on(t.slug),
  }),
);

export const customDomains = pgTable(
  'custom_domains',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull(),
    domain: text('domain').notNull(),
    /** `'pending' | 'provisioning' | 'live' | 'failed'`. */
    status: text('status').notNull().default('pending'),
    tlsCertArn: text('tls_cert_arn'),
    dnsRecords: jsonb('dns_records').notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    domainIdx: uniqueIndex('uniq_custom_domains_domain').on(t.domain),
    workspaceIdx: index('idx_custom_domains_workspace').on(t.workspaceId),
  }),
);
