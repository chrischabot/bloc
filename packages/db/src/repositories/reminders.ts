import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import type { Database } from '../client.ts';
import { reminders } from '../schema/reminders.ts';

export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;

export interface CreateReminderInput {
  workspaceId: string;
  parentType: 'page' | 'block';
  parentId: string;
  userId: string;
  dueAt: Date;
  label?: string | null;
  createdBy: string;
}

export async function createReminder(db: Database, input: CreateReminderInput): Promise<Reminder> {
  const insertArgs: NewReminder = {
    workspaceId: input.workspaceId,
    parentType: input.parentType,
    parentId: input.parentId,
    userId: input.userId,
    dueAt: input.dueAt,
    createdBy: input.createdBy,
  };
  if (input.label !== null && input.label !== undefined) insertArgs.label = input.label;
  const [row] = await db.insert(reminders).values(insertArgs).returning();
  if (!row) throw new Error('createReminder: empty insert');
  return row;
}

export async function listRemindersForUser(
  db: Database,
  args: { userId: string; includeFired?: boolean; limit?: number },
): Promise<Reminder[]> {
  const conditions = [eq(reminders.userId, args.userId)];
  if (!(args.includeFired ?? false)) {
    conditions.push(eq(reminders.fired, false));
  }
  return db
    .select()
    .from(reminders)
    .where(and(...conditions))
    .orderBy(asc(reminders.dueAt))
    .limit(args.limit ?? 100);
}

export async function listRemindersForResource(
  db: Database,
  args: { parentType: 'page' | 'block'; parentId: string },
): Promise<Reminder[]> {
  return db
    .select()
    .from(reminders)
    .where(and(eq(reminders.parentType, args.parentType), eq(reminders.parentId, args.parentId)))
    .orderBy(desc(reminders.createdAt));
}

export async function getReminder(db: Database, id: string): Promise<Reminder | null> {
  const [row] = await db.select().from(reminders).where(eq(reminders.id, id)).limit(1);
  return row ?? null;
}

export async function deleteReminder(db: Database, id: string): Promise<boolean> {
  const result = await db.delete(reminders).where(eq(reminders.id, id)).returning();
  return result.length > 0;
}

export async function markFired(db: Database, id: string): Promise<Reminder | null> {
  const [row] = await db
    .update(reminders)
    .set({ fired: true, firedAt: new Date() })
    .where(eq(reminders.id, id))
    .returning();
  return row ?? null;
}

/** Find every unfired reminder due at or before `at`. */
export async function findDueReminders(
  db: Database,
  args: { at: Date; limit?: number },
): Promise<Reminder[]> {
  return db
    .select()
    .from(reminders)
    .where(and(eq(reminders.fired, false), lte(reminders.dueAt, args.at)))
    .orderBy(asc(reminders.dueAt))
    .limit(args.limit ?? 1000);
}

/** Search reminders in an inclusive date range. */
export async function listRemindersByRange(
  db: Database,
  args: { userId: string; from: Date; to: Date },
): Promise<Reminder[]> {
  return db
    .select()
    .from(reminders)
    .where(
      and(
        eq(reminders.userId, args.userId),
        gte(reminders.dueAt, args.from),
        lte(reminders.dueAt, args.to),
      ),
    )
    .orderBy(asc(reminders.dueAt));
}
