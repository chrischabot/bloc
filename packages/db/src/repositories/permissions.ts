import { and, eq, inArray } from 'drizzle-orm';
import type { Database } from '../client.ts';
import { PERMISSION_LEVELS, type PermissionLevel, permissions } from '../schema/permissions.ts';
import { workspaceMembers } from '../schema/workspaces.ts';

export interface Actor {
  userId: string;
  workspaceId: string;
}

export interface ResourceRef {
  type: 'page' | 'database';
  id: string;
}

/** Strict-greater priority over `b`? (Higher = more privilege; `full_access` > … > `no_access`.) */
function levelRank(l: PermissionLevel): number {
  return PERMISSION_LEVELS.length - PERMISSION_LEVELS.indexOf(l);
}

export function hasPrivilege(actual: PermissionLevel, required: PermissionLevel): boolean {
  if (actual === 'no_access') return false;
  return levelRank(actual) >= levelRank(required);
}

export async function grant(db: Database, input: typeof permissions.$inferInsert): Promise<void> {
  await db.insert(permissions).values(input);
}

export async function revoke(
  db: Database,
  args: { resourceType: 'page' | 'database'; resourceId: string; granteeId?: string },
): Promise<void> {
  const conditions = [
    eq(permissions.resourceType, args.resourceType),
    eq(permissions.resourceId, args.resourceId),
  ];
  if (args.granteeId !== undefined) conditions.push(eq(permissions.granteeId, args.granteeId));
  await db.delete(permissions).where(and(...conditions));
}

/**
 * Resolve the effective permission level for an actor on a resource.
 * Walks: explicit ACL entries (user, group, workspace, teamspace, public) → workspace role.
 * Returns the highest level granted. Workspace owners always get `full_access`.
 */
export async function resolveLevel(
  db: Database,
  actor: Actor,
  resource: ResourceRef,
): Promise<PermissionLevel> {
  // Workspace owners and membership admins get full access workspace-wide.
  const [member] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, actor.workspaceId),
        eq(workspaceMembers.userId, actor.userId),
      ),
    )
    .limit(1);
  if (!member) return 'no_access';
  if (member.role === 'owner') return 'full_access';
  if (member.role === 'membership_admin') return 'full_access';

  // Look up explicit ACL grants on the resource (user or workspace-wide).
  const explicit = await db
    .select({ level: permissions.level, granteeType: permissions.granteeType })
    .from(permissions)
    .where(
      and(
        eq(permissions.resourceType, resource.type),
        eq(permissions.resourceId, resource.id),
        inArray(permissions.granteeType, ['user', 'workspace', 'public']),
      ),
    );

  let best: PermissionLevel | null = null;
  for (const entry of explicit) {
    const lvl = entry.level as PermissionLevel;
    if (lvl === 'no_access') return 'no_access';
    if (best === null || levelRank(lvl) > levelRank(best)) best = lvl;
  }

  if (best !== null) return best;

  // Fall back to default-by-role.
  if (member.role === 'restricted_member') return 'can_read';
  if (member.role === 'guest') return 'no_access';
  return 'can_read';
}

export async function requirePermission(
  db: Database,
  actor: Actor,
  resource: ResourceRef,
  required: PermissionLevel,
): Promise<void> {
  const actual = await resolveLevel(db, actor, resource);
  if (!hasPrivilege(actual, required)) {
    const err = new Error(
      `requirePermission: actor ${actor.userId} has '${actual}' on ${resource.type}:${resource.id}, needs '${required}'`,
    );
    (err as Error & { code?: string }).code = 'restricted_resource';
    throw err;
  }
}
