import { sql } from 'drizzle-orm';
import { index, inet, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const permissions = pgTable(
  'permissions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    /** `'page' | 'database'`. */
    resourceType: text('resource_type').notNull(),
    resourceId: uuid('resource_id').notNull(),
    /** `'user' | 'workspace' | 'public' | 'link' | 'teamspace' | 'group'`. */
    granteeType: text('grantee_type').notNull(),
    granteeId: uuid('grantee_id'),
    /** `'full_access' | 'can_edit' | 'can_edit_content' | 'can_comment' | 'can_read' | 'no_access'`. */
    level: text('level').notNull(),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    resourceIdx: index('idx_permissions_resource').on(t.resourceType, t.resourceId),
  }),
);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull(),
    actorUserId: uuid('actor_user_id'),
    action: text('action').notNull(),
    resourceType: text('resource_type'),
    resourceId: uuid('resource_id'),
    metadata: jsonb('metadata'),
    ip: inet('ip'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceCreatedIdx: index('idx_audit_workspace_created').on(t.workspaceId, t.createdAt),
  }),
);

/** Permission levels in priority order (highest privilege first). */
export const PERMISSION_LEVELS = [
  'full_access',
  'can_edit',
  'can_edit_content',
  'can_comment',
  'can_read',
  'no_access',
] as const;
export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];
