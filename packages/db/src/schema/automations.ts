import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const buttons = pgTable(
  'buttons',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    /** The block carrying this button. Unique. */
    blockId: uuid('block_id').notNull(),
    /** Action steps (discriminated union per @bloc/shared automations). */
    steps: jsonb('steps').notNull().default(sql`'[]'::jsonb`),
    /** Optional `{ enabled, message }` confirmation prompt. */
    confirm: jsonb('confirm').notNull().default(sql`'{"enabled":false,"message":""}'::jsonb`),
    createdBy: uuid('created_by').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    blockIdx: uniqueIndex('uniq_buttons_block').on(t.blockId),
  }),
);

export const automations = pgTable(
  'automations',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    databaseId: uuid('database_id').notNull(),
    name: text('name').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    /** `{ kind: 'page_added' | 'page_property_changed' | 'page_property_meets' | 'time', ... }`. */
    trigger: jsonb('trigger').notNull(),
    /** Action steps. */
    steps: jsonb('steps').notNull().default(sql`'[]'::jsonb`),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    lastRunAt: timestamp('last_run_at', { withTimezone: true, mode: 'date' }),
    runsCount: integer('runs_count').notNull().default(0),
  },
  (t) => ({
    dbIdx: index('idx_automations_database').on(t.databaseId),
  }),
);

export const automationRuns = pgTable(
  'automation_runs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    /** Null when this is a button invocation, set when this is an automation run. */
    automationId: uuid('automation_id'),
    /** Null for automation runs; set for button invocations. */
    buttonBlockId: uuid('button_block_id'),
    /** Idempotency key for at-least-once trigger fanout (NULL for button invokes). */
    triggerEventId: text('trigger_event_id'),
    /** `'success' | 'partial' | 'failed' | 'rate_limited'`. */
    status: text('status').notNull(),
    /** Per-step log: `[{ index, type, status, duration_ms, output? }, ...]`. */
    stepsLog: jsonb('steps_log').notNull().default(sql`'[]'::jsonb`),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => ({
    automationIdx: index('idx_automation_runs_automation').on(t.automationId),
    idemIdx: uniqueIndex('uniq_automation_runs_idem').on(t.automationId, t.triggerEventId),
  }),
);
