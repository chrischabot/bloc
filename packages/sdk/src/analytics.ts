import type { BlocClient } from './client.ts';

export interface AnalyticsBeacon {
  kind: 'page_view' | 'web_vital' | 'ui_action';
  page_id?: string;
  metric?: 'LCP' | 'INP' | 'CLS' | 'TTFB' | 'FCP';
  value?: number;
  action?: string;
  ts?: number;
}

export interface AnalyticsSummary {
  object: 'analytics_summary';
  workspace_id: string;
  total_events: number;
  page_views: number;
  web_vitals: Record<string, { count: number; p50: number; p95: number }>;
  ui_actions: Record<string, number>;
}

export class AnalyticsNamespace {
  constructor(private readonly client: BlocClient) {}

  beacon(args: AnalyticsBeacon): Promise<void> {
    return this.client.request({
      method: 'POST',
      path: '/v1/analytics/beacon',
      body: args,
    });
  }

  summary(): Promise<AnalyticsSummary> {
    return this.client.request<AnalyticsSummary>({
      method: 'GET',
      path: '/v1/analytics/summary',
    });
  }

  events(args: { kind?: string; page_size?: number } = {}): Promise<{
    object: 'list';
    type: 'analytics_event';
    results: Array<Record<string, unknown>>;
    next_cursor: string | null;
    has_more: boolean;
  }> {
    return this.client.request({
      method: 'GET',
      path: '/v1/analytics/events',
      query: {
        ...(args.kind !== undefined ? { kind: args.kind } : {}),
        ...(args.page_size !== undefined ? { page_size: args.page_size } : {}),
      },
    });
  }
}
