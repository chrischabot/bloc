import { and, eq } from 'drizzle-orm';
import type { Database } from '../client.ts';
import { type WorkspaceRole, workspaceMembers, workspaces } from '../schema/workspaces.ts';

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;

export async function createWorkspace(db: Database, input: NewWorkspace): Promise<Workspace> {
  const [row] = await db.insert(workspaces).values(input).returning();
  if (!row) throw new Error('createWorkspace: empty insert result');
  return row;
}

export async function getWorkspace(db: Database, id: string): Promise<Workspace | null> {
  const [row] = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
  return row ?? null;
}

export async function addMember(
  db: Database,
  args: { workspaceId: string; userId: string; role: WorkspaceRole },
): Promise<void> {
  await db.insert(workspaceMembers).values(args).onConflictDoNothing();
}

export async function removeMember(
  db: Database,
  args: { workspaceId: string; userId: string },
): Promise<void> {
  await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, args.workspaceId),
        eq(workspaceMembers.userId, args.userId),
      ),
    );
}

export async function listMembers(
  db: Database,
  workspaceId: string,
): Promise<{ userId: string; role: string }[]> {
  const rows = await db
    .select({ userId: workspaceMembers.userId, role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));
  return rows;
}

export async function getMemberRole(
  db: Database,
  args: { workspaceId: string; userId: string },
): Promise<string | null> {
  const [row] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, args.workspaceId),
        eq(workspaceMembers.userId, args.userId),
      ),
    )
    .limit(1);
  return row?.role ?? null;
}
