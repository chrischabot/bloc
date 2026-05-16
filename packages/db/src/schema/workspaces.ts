import { sql } from 'drizzle-orm';
import {
  boolean,
  inet,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  /** JSON: `{ type: 'emoji'|'external'|'file', ... }` */
  icon: text('icon'),
  /** Optional SSO domain. */
  domain: text('domain').unique(),
  plan: text('plan').notNull().default('free'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    email: text('email').notNull(),
    name: text('name'),
    avatarUrl: text('avatar_url'),
    /** `'person'` or `'bot'`. */
    type: text('type').notNull().default('person'),
    /** When type='bot', the owning user. */
    botOwnerId: uuid('bot_owner_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
  }),
);

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id').notNull(),
    userId: uuid('user_id').notNull(),
    /** `'owner' | 'membership_admin' | 'member' | 'restricted_member' | 'guest'`. */
    role: text('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.workspaceId, t.userId] }),
  }),
);

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  userAgent: text('user_agent'),
  ip: inet('ip'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const integrations = pgTable('integrations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: uuid('workspace_id').notNull(),
  ownerUserId: uuid('owner_user_id').notNull(),
  name: text('name').notNull(),
  /** bcrypt hash of the raw token. */
  tokenHash: text('token_hash').notNull(),
  /** Token prefix for fast lookup (first 16 chars of secret_...). */
  tokenPrefix: text('token_prefix').notNull(),
  /** JSON array of capability strings. */
  capabilities: text('capabilities').notNull().default('[]'),
  revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

/** Possible workspace_members.role values. */
export const WORKSPACE_ROLES = [
  'owner',
  'membership_admin',
  'member',
  'restricted_member',
  'guest',
] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/** Possible users.type values. */
export const USER_TYPES = ['person', 'bot'] as const;
export type UserType = (typeof USER_TYPES)[number];

/** Stored booleans we frequently care about. Kept here for documentation. */
export const _BOOL_HELPER = boolean('_bool_helper');
