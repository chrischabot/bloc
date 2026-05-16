import {
  type AnalyticsEvent,
  type ClientHandle,
  getMemberRole,
  listAnalyticsEvents,
  recordAnalyticsEvent,
} from '@bloc/db';
import { withSpan } from '@bloc/observability';
import { BlocRestrictedError, BlocValidationError, encodeCursor } from '@bloc/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import '../types.ts';

interface Deps {
  handle: ClientHandle;
}

const WebVitalMetric = z.enum(['LCP', 'INP', 'CLS', 'TTFB', 'FCP']);

const BeaconSchema = z
  .object({
    kind: z.enum(['page_view', 'web_vital', 'ui_action']),
    page_id: z.string().uuid().optional(),
    metric: WebVitalMetric.optional(),
    value: z.number().nonnegative().max(60_000).optional(),
    action: z.string().max(100).optional(),
    ts: z.number().int().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.kind === 'web_vital') {
      if (data.metric === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['metric'],
          message: 'metric is required for web_vital beacons',
        });
      }
      if (data.value === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['value'],
          message: 'value is required for web_vital beacons',
        });
      }
    }
    if (data.kind === 'ui_action' && data.action === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['action'],
        message: 'action is required for ui_action beacons',
      });
    }
  });

interface SerializedEvent {
  object: 'analytics_event';
  id: string;
  workspace_id: string;
  user_id: string | null;
  kind: string;
  page_id: string | null;
  metric: string | null;
  value: number | null;
  action: string | null;
  created_at: string;
}

function serialize(row: AnalyticsEvent): SerializedEvent {
  return {
    object: 'analytics_event',
    id: row.id,
    workspace_id: row.workspaceId,
    user_id: row.userId,
    kind: row.kind,
    page_id: row.pageId,
    metric: row.metric,
    value: row.value,
    action: row.action,
    created_at: row.createdAt.toISOString(),
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

export function createAnalyticsRouter(deps: Deps): Hono {
  const router = new Hono();

  // POST /v1/analytics/beacon — write a single measurement.
  router.post('/beacon', async (c) => {
    const actor = c.get('actor');
    const body = BeaconSchema.parse(await c.req.json());
    return withSpan('analytics', 'analytics.beacon', { 'beacon.kind': body.kind }, async () => {
      const args: Parameters<typeof recordAnalyticsEvent>[1] = {
        workspaceId: actor.workspaceId,
        userId: actor.userId,
        kind: body.kind,
      };
      if (body.page_id !== undefined) args.pageId = body.page_id;
      if (body.metric !== undefined) args.metric = body.metric;
      if (body.value !== undefined) args.value = body.value;
      if (body.action !== undefined) args.action = body.action;
      await recordAnalyticsEvent(deps.handle.db, args);
      return c.body(null, 204);
    });
  });

  // GET /v1/analytics/events — admin-only raw event listing.
  router.get('/events', async (c) => {
    const actor = c.get('actor');
    const requestId = c.get('requestId');
    const role = await getMemberRole(deps.handle.db, {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
    });
    if (role !== 'owner' && role !== 'membership_admin') {
      throw new BlocRestrictedError(
        `Admin role required (actor has '${role ?? 'none'}')`,
        requestId,
      );
    }
    const url = new URL(c.req.url);
    const pageSize = Math.max(1, Math.min(200, Number(url.searchParams.get('page_size') ?? 100)));
    const kindFilter = url.searchParams.get('kind');
    if (kindFilter !== null && !['page_view', 'web_vital', 'ui_action'].includes(kindFilter)) {
      throw new BlocValidationError(`Unknown kind '${kindFilter}'`, requestId);
    }
    return withSpan('analytics', 'analytics.list', {}, async () => {
      const args: Parameters<typeof listAnalyticsEvents>[1] = {
        workspaceId: actor.workspaceId,
        limit: pageSize + 1,
      };
      if (kindFilter !== null) args.kind = kindFilter;
      const rows = await listAnalyticsEvents(deps.handle.db, args);
      const hasMore = rows.length > pageSize;
      const window = hasMore ? rows.slice(0, pageSize) : rows;
      return c.json({
        object: 'list',
        type: 'analytics_event',
        results: window.map(serialize),
        next_cursor: hasMore ? encodeCursor({ offset: pageSize }) : null,
        has_more: hasMore,
        analytics_event: {},
      });
    });
  });

  // GET /v1/analytics/summary — aggregated per-metric counts + p50/p95.
  router.get('/summary', async (c) => {
    const actor = c.get('actor');
    const requestId = c.get('requestId');
    const role = await getMemberRole(deps.handle.db, {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
    });
    if (role !== 'owner' && role !== 'membership_admin') {
      throw new BlocRestrictedError(
        `Admin role required (actor has '${role ?? 'none'}')`,
        requestId,
      );
    }
    return withSpan('analytics', 'analytics.summary', {}, async () => {
      const rows = await listAnalyticsEvents(deps.handle.db, {
        workspaceId: actor.workspaceId,
        limit: 10_000,
      });
      let pageViews = 0;
      const webVitalsByMetric = new Map<string, number[]>();
      const uiActionsByName = new Map<string, number>();
      for (const r of rows) {
        if (r.kind === 'page_view') {
          pageViews += 1;
        } else if (r.kind === 'web_vital' && r.metric !== null && r.value !== null) {
          const arr = webVitalsByMetric.get(r.metric) ?? [];
          arr.push(r.value);
          webVitalsByMetric.set(r.metric, arr);
        } else if (r.kind === 'ui_action' && r.action !== null) {
          uiActionsByName.set(r.action, (uiActionsByName.get(r.action) ?? 0) + 1);
        }
      }
      const webVitals: Record<string, { count: number; p50: number; p95: number }> = {};
      for (const [metric, values] of webVitalsByMetric.entries()) {
        const sorted = [...values].sort((a, b) => a - b);
        webVitals[metric] = {
          count: sorted.length,
          p50: percentile(sorted, 50),
          p95: percentile(sorted, 95),
        };
      }
      const uiActions: Record<string, number> = {};
      for (const [action, count] of uiActionsByName.entries()) {
        uiActions[action] = count;
      }
      return c.json({
        object: 'analytics_summary',
        workspace_id: actor.workspaceId,
        total_events: rows.length,
        page_views: pageViews,
        web_vitals: webVitals,
        ui_actions: uiActions,
      });
    });
  });

  return router;
}
