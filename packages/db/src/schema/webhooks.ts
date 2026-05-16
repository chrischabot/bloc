import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const webhooks = pgTable(
  'webhooks',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull(),
    /** Owner integration; null when created via session. */
    integrationId: uuid('integration_id'),
    ownerUserId: uuid('owner_user_id').notNull(),
    endpointUrl: text('endpoint_url').notNull(),
    /** Plaintext signing secret (whsec_ prefix). Returned only on create. */
    signingSecret: text('signing_secret').notNull(),
    /** JSON array of subscribed event types. */
    subscribedEvents: jsonb('subscribed_events')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** Optional filter object: `{ workspace_id?, page_ids? }`. */
    filter: jsonb('filter').notNull().default(sql`'{}'::jsonb`),
    /** `'unverified' | 'active' | 'auto_disabled'`. */
    status: text('status').notNull().default('unverified'),
    /** Count of consecutive failed deliveries; reset on success. */
    failureStreak: integer('failure_streak').notNull().default(0),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceIdx: index('idx_webhooks_workspace').on(t.workspaceId),
  }),
);

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    webhookId: uuid('webhook_id').notNull(),
    /** Unique idempotent event id sent to the endpoint. */
    eventId: uuid('event_id').notNull(),
    eventType: text('event_type').notNull(),
    /** `'pending' | 'success' | 'failed' | 'verification'`. */
    status: text('status').notNull(),
    /** HTTP status from endpoint, when known. */
    httpStatus: integer('http_status'),
    attempt: integer('attempt').notNull().default(1),
    latencyMs: integer('latency_ms'),
    requestBody: jsonb('request_body').notNull(),
    responseBody: text('response_body'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    webhookIdx: index('idx_webhook_deliveries_webhook').on(t.webhookId),
  }),
);
