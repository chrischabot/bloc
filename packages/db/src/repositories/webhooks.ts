import { randomBytes } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../client.ts';
import { webhookDeliveries, webhooks } from '../schema/webhooks.ts';

export type Webhook = typeof webhooks.$inferSelect;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;

/** Generate a fresh signing secret (32 bytes, `whsec_` prefix, 43 URL-safe base64 chars). */
export function generateSigningSecret(): string {
  return `whsec_${randomBytes(32).toString('base64url')}`;
}

export async function createWebhook(
  db: Database,
  args: {
    workspaceId: string;
    ownerUserId: string;
    integrationId?: string | null;
    endpointUrl: string;
    subscribedEvents: string[];
    filter?: Record<string, unknown>;
  },
): Promise<Webhook> {
  const signingSecret = generateSigningSecret();
  const insertArgs: typeof webhooks.$inferInsert = {
    workspaceId: args.workspaceId,
    ownerUserId: args.ownerUserId,
    endpointUrl: args.endpointUrl,
    signingSecret,
    subscribedEvents: args.subscribedEvents as Webhook['subscribedEvents'],
    filter: (args.filter ?? {}) as Webhook['filter'],
  };
  if (args.integrationId !== null && args.integrationId !== undefined) {
    insertArgs.integrationId = args.integrationId;
  }
  const [row] = await db.insert(webhooks).values(insertArgs).returning();
  if (!row) throw new Error('createWebhook: empty insert');
  return row;
}

export async function getWebhook(db: Database, id: string): Promise<Webhook | null> {
  const [row] = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
  return row ?? null;
}

export async function listWebhooks(db: Database, workspaceId: string): Promise<Webhook[]> {
  return db
    .select()
    .from(webhooks)
    .where(eq(webhooks.workspaceId, workspaceId))
    .orderBy(desc(webhooks.createdAt));
}

export async function updateWebhook(
  db: Database,
  id: string,
  patch: Partial<{
    endpointUrl: string;
    subscribedEvents: string[];
    filter: Record<string, unknown>;
    status: 'unverified' | 'active' | 'auto_disabled';
    failureStreak: number;
    enabled: boolean;
  }>,
): Promise<Webhook | null> {
  const update: Partial<typeof webhooks.$inferInsert> = { updatedAt: new Date() };
  if (patch.endpointUrl !== undefined) update.endpointUrl = patch.endpointUrl;
  if (patch.subscribedEvents !== undefined) {
    update.subscribedEvents = patch.subscribedEvents as Webhook['subscribedEvents'];
  }
  if (patch.filter !== undefined) update.filter = patch.filter as Webhook['filter'];
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.failureStreak !== undefined) update.failureStreak = patch.failureStreak;
  if (patch.enabled !== undefined) update.enabled = patch.enabled;
  const [row] = await db.update(webhooks).set(update).where(eq(webhooks.id, id)).returning();
  return row ?? null;
}

export async function deleteWebhook(db: Database, id: string): Promise<boolean> {
  const result = await db.delete(webhooks).where(eq(webhooks.id, id)).returning();
  return result.length > 0;
}

export async function recordDelivery(
  db: Database,
  args: {
    webhookId: string;
    eventId: string;
    eventType: string;
    status: 'pending' | 'success' | 'failed' | 'verification';
    httpStatus?: number;
    attempt?: number;
    latencyMs?: number;
    requestBody: unknown;
    responseBody?: string;
    error?: string;
  },
): Promise<WebhookDelivery> {
  const insertArgs: typeof webhookDeliveries.$inferInsert = {
    webhookId: args.webhookId,
    eventId: args.eventId,
    eventType: args.eventType,
    status: args.status,
    attempt: args.attempt ?? 1,
    requestBody: args.requestBody as WebhookDelivery['requestBody'],
  };
  if (args.httpStatus !== undefined) insertArgs.httpStatus = args.httpStatus;
  if (args.latencyMs !== undefined) insertArgs.latencyMs = args.latencyMs;
  if (args.responseBody !== undefined) insertArgs.responseBody = args.responseBody;
  if (args.error !== undefined) insertArgs.error = args.error;
  const [row] = await db.insert(webhookDeliveries).values(insertArgs).returning();
  if (!row) throw new Error('recordDelivery: empty insert');
  return row;
}

export async function listDeliveries(
  db: Database,
  webhookId: string,
  limit = 100,
): Promise<WebhookDelivery[]> {
  return db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, webhookId))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit);
}

export async function listActiveWebhooksForEvent(
  db: Database,
  workspaceId: string,
  eventType: string,
): Promise<Webhook[]> {
  // Drizzle doesn't have a clean cross-DB jsonb-array containment helper that
  // works the same on Postgres + PGlite; filter in-process for v1.
  const rows = await db
    .select()
    .from(webhooks)
    .where(
      and(
        eq(webhooks.workspaceId, workspaceId),
        eq(webhooks.status, 'active'),
        eq(webhooks.enabled, true),
      ),
    );
  return rows.filter((r) => {
    const events = r.subscribedEvents ?? [];
    return events.includes(eventType);
  });
}
