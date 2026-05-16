import { desc, eq } from 'drizzle-orm';
import type { Database } from '../client.ts';
import { automationRuns, automations, buttons } from '../schema/automations.ts';

export type Button = typeof buttons.$inferSelect;
export type Automation = typeof automations.$inferSelect;
export type AutomationRun = typeof automationRuns.$inferSelect;

export async function upsertButton(
  db: Database,
  args: {
    blockId: string;
    steps: unknown;
    confirm?: unknown;
    createdBy: string;
  },
): Promise<Button> {
  const [existing] = await db
    .select()
    .from(buttons)
    .where(eq(buttons.blockId, args.blockId))
    .limit(1);
  if (existing !== undefined) {
    const [updated] = await db
      .update(buttons)
      .set({
        steps: args.steps as Button['steps'],
        ...(args.confirm !== undefined ? { confirm: args.confirm as Button['confirm'] } : {}),
        updatedAt: new Date(),
      })
      .where(eq(buttons.id, existing.id))
      .returning();
    if (!updated) throw new Error('upsertButton: update returned no row');
    return updated;
  }
  const insertArgs: typeof buttons.$inferInsert = {
    blockId: args.blockId,
    steps: args.steps as Button['steps'],
    createdBy: args.createdBy,
  };
  if (args.confirm !== undefined) insertArgs.confirm = args.confirm as Button['confirm'];
  const [created] = await db.insert(buttons).values(insertArgs).returning();
  if (!created) throw new Error('upsertButton: insert returned no row');
  return created;
}

export async function getButtonByBlock(db: Database, blockId: string): Promise<Button | null> {
  const [row] = await db.select().from(buttons).where(eq(buttons.blockId, blockId)).limit(1);
  return row ?? null;
}

export async function createAutomation(
  db: Database,
  args: {
    databaseId: string;
    name: string;
    trigger: unknown;
    steps: unknown;
    enabled?: boolean;
    createdBy: string;
  },
): Promise<Automation> {
  const [row] = await db
    .insert(automations)
    .values({
      databaseId: args.databaseId,
      name: args.name,
      trigger: args.trigger as Automation['trigger'],
      steps: args.steps as Automation['steps'],
      enabled: args.enabled ?? true,
      createdBy: args.createdBy,
    })
    .returning();
  if (!row) throw new Error('createAutomation: empty insert');
  return row;
}

export async function listAutomations(db: Database, databaseId: string): Promise<Automation[]> {
  return db
    .select()
    .from(automations)
    .where(eq(automations.databaseId, databaseId))
    .orderBy(desc(automations.createdAt));
}

export async function getAutomation(db: Database, id: string): Promise<Automation | null> {
  const [row] = await db.select().from(automations).where(eq(automations.id, id)).limit(1);
  return row ?? null;
}

export async function updateAutomation(
  db: Database,
  id: string,
  patch: { name?: string; trigger?: unknown; steps?: unknown; enabled?: boolean },
): Promise<Automation | null> {
  const update: Partial<typeof automations.$inferInsert> = { updatedAt: new Date() };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.trigger !== undefined) update.trigger = patch.trigger as Automation['trigger'];
  if (patch.steps !== undefined) update.steps = patch.steps as Automation['steps'];
  if (patch.enabled !== undefined) update.enabled = patch.enabled;
  const [row] = await db.update(automations).set(update).where(eq(automations.id, id)).returning();
  return row ?? null;
}

export async function deleteAutomation(db: Database, id: string): Promise<boolean> {
  const result = await db.delete(automations).where(eq(automations.id, id)).returning();
  return result.length > 0;
}

export async function recordRun(
  db: Database,
  args: {
    automationId?: string | null;
    buttonBlockId?: string | null;
    triggerEventId?: string | null;
    status: 'success' | 'partial' | 'failed' | 'rate_limited';
    stepsLog: unknown[];
  },
): Promise<AutomationRun> {
  const insertArgs: typeof automationRuns.$inferInsert = {
    status: args.status,
    stepsLog: args.stepsLog as AutomationRun['stepsLog'],
    endedAt: new Date(),
  };
  if (args.automationId !== null && args.automationId !== undefined) {
    insertArgs.automationId = args.automationId;
  }
  if (args.buttonBlockId !== null && args.buttonBlockId !== undefined) {
    insertArgs.buttonBlockId = args.buttonBlockId;
  }
  if (args.triggerEventId !== null && args.triggerEventId !== undefined) {
    insertArgs.triggerEventId = args.triggerEventId;
  }
  const [row] = await db.insert(automationRuns).values(insertArgs).returning();
  if (!row) throw new Error('recordRun: empty insert');
  // Bump automation counters.
  if (args.automationId !== null && args.automationId !== undefined) {
    const fresh = await db
      .select()
      .from(automations)
      .where(eq(automations.id, args.automationId))
      .limit(1);
    const cur = fresh[0];
    if (cur !== undefined) {
      await db
        .update(automations)
        .set({ lastRunAt: new Date(), runsCount: cur.runsCount + 1 })
        .where(eq(automations.id, args.automationId));
    }
  }
  return row;
}

export async function listAutomationRuns(
  db: Database,
  automationId: string,
  limit = 100,
): Promise<AutomationRun[]> {
  return db
    .select()
    .from(automationRuns)
    .where(eq(automationRuns.automationId, automationId))
    .orderBy(desc(automationRuns.startedAt))
    .limit(limit);
}
