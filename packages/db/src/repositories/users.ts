import { eq, sql } from 'drizzle-orm';
import type { Database } from '../client.ts';
import { users } from '../schema/workspaces.ts';

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export async function createUser(db: Database, input: NewUser): Promise<User> {
  const [row] = await db.insert(users).values(input).returning();
  if (!row) throw new Error('createUser: empty insert result');
  return row;
}

export async function getUser(db: Database, id: string): Promise<User | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export async function findUserByEmail(db: Database, email: string): Promise<User | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);
  return row ?? null;
}

export async function listUsers(db: Database, limit = 100): Promise<User[]> {
  return db.select().from(users).limit(limit);
}
