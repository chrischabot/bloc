# `bloc.analytics`

REST mapping: [`/v1/analytics`](../api/endpoints/analytics.md).

## Types

```ts
interface AnalyticsBeacon {
  kind:    'page_view' | 'web_vital' | 'ui_action';
  page_id?: string;
  metric?:  'LCP' | 'INP' | 'CLS' | 'TTFB' | 'FCP';
  value?:   number;
  action?:  string;
  ts?:      number;     // unix ms
}

interface AnalyticsSummary {
  object:       'analytics_summary';
  workspace_id: string;
  total_events: number;
  page_views:   number;
  web_vitals:   Record<string, { count: number; p50: number; p95: number }>;
  ui_actions:   Record<string, number>;
}
```

## `bloc.analytics.beacon(args) → Promise<void>`

```ts
args: AnalyticsBeacon
```

Fire-and-forget client beacon. The 204 response is dropped by the SDK; failures don't throw.

## `bloc.analytics.summary() → Promise<AnalyticsSummary>`

Admin-only. Returns the workspace-scoped aggregate.

## `bloc.analytics.events(args?) → Promise<...>`

```ts
args: { kind?: string; page_size?: number }
```

Returns the raw event stream (paginated). Use for ad-hoc analysis.
