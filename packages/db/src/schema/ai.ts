import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const aiRuns = pgTable(
  'ai_runs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull(),
    userId: uuid('user_id').notNull(),
    surface: text('surface').notNull(),
    model: text('model').notNull(),
    promptHash: text('prompt_hash').notNull(),
    tokensIn: integer('tokens_in').notNull().default(0),
    tokensOut: integer('tokens_out').notNull().default(0),
    costUsdMicro: integer('cost_usd_micro').notNull().default(0),
    latencyMs: integer('latency_ms').notNull().default(0),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceIdx: index('idx_ai_runs_workspace').on(t.workspaceId, t.createdAt),
  }),
);
