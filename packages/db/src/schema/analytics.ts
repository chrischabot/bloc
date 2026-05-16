import { desc, sql } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull(),
    userId: uuid('user_id'),
    /** `'page_view' | 'web_vital' | 'ui_action'`. */
    kind: text('kind').notNull(),
    pageId: uuid('page_id'),
    /** `'LCP' | 'INP' | 'CLS' | 'TTFB' | 'FCP'` for web_vital kind. */
    metric: text('metric'),
    /** Metric value (ms for timing, milliscore for CLS). */
    value: integer('value'),
    /** For ui_action: dot-namespaced action label. */
    action: text('action'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceIdx: index('idx_analytics_workspace_created').on(t.workspaceId, desc(t.createdAt)),
  }),
);
