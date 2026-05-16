import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../client.ts';
import { analyticsEvents } from '../schema/analytics.ts';

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;

export async function recordAnalyticsEvent(
  db: Database,
  args: {
    workspaceId: string;
    userId?: string | null;
    kind: string;
    pageId?: string | null;
    metric?: string | null;
    value?: number | null;
    action?: string | null;
  },
): Promise<AnalyticsEvent> {
  const insertArgs: NewAnalyticsEvent = {
    workspaceId: args.workspaceId,
    kind: args.kind,
  };
  if (args.userId !== null && args.userId !== undefined) insertArgs.userId = args.userId;
  if (args.pageId !== null && args.pageId !== undefined) insertArgs.pageId = args.pageId;
  if (args.metric !== null && args.metric !== undefined) insertArgs.metric = args.metric;
  if (args.value !== null && args.value !== undefined) insertArgs.value = Math.round(args.value);
  if (args.action !== null && args.action !== undefined) insertArgs.action = args.action;
  const [row] = await db.insert(analyticsEvents).values(insertArgs).returning();
  if (!row) throw new Error('recordAnalyticsEvent: empty insert');
  return row;
}

export async function listAnalyticsEvents(
  db: Database,
  args: { workspaceId: string; kind?: string; limit?: number },
): Promise<AnalyticsEvent[]> {
  const conditions = [eq(analyticsEvents.workspaceId, args.workspaceId)];
  if (args.kind !== undefined) conditions.push(eq(analyticsEvents.kind, args.kind));
  return db
    .select()
    .from(analyticsEvents)
    .where(and(...conditions))
    .orderBy(desc(analyticsEvents.createdAt))
    .limit(args.limit ?? 100);
}
