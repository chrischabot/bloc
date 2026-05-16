import { desc, eq } from 'drizzle-orm';
import type { Database } from '../client.ts';
import { auditEvents } from '../schema/permissions.ts';

export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;

export async function recordEvent(db: Database, input: NewAuditEvent): Promise<AuditEvent> {
  const [row] = await db.insert(auditEvents).values(input).returning();
  if (!row) throw new Error('recordEvent: empty insert');
  return row;
}

export async function listWorkspaceEvents(
  db: Database,
  workspaceId: string,
  limit = 100,
): Promise<AuditEvent[]> {
  return db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.workspaceId, workspaceId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit);
}
