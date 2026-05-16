import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] as const;

/** Process-wide registry. */
export const registry = new Registry();

collectDefaultMetrics({ register: registry });

/** HTTP request counter. */
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests by method, route, and status code',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

/** HTTP request duration histogram. */
export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'] as const,
  buckets: [...DEFAULT_BUCKETS],
  registers: [registry],
});

/** WS connection gauge. */
export const wsConnectionsActive = new Gauge({
  name: 'ws_connections_active',
  help: 'Currently active WebSocket connections',
  registers: [registry],
});

/** WS message counter. */
export const wsMessagesTotal = new Counter({
  name: 'ws_messages_total',
  help: 'WebSocket messages by direction and kind',
  labelNames: ['direction', 'kind'] as const,
  registers: [registry],
});

/** DB query duration histogram. */
export const dbQueryDurationSeconds = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['repository', 'operation'] as const,
  buckets: [...DEFAULT_BUCKETS],
  registers: [registry],
});

/** Cache hit / miss counters. */
export const cacheHitsTotal = new Counter({
  name: 'cache_hits_total',
  help: 'Cache hits by key prefix',
  labelNames: ['prefix'] as const,
  registers: [registry],
});

export const cacheMissesTotal = new Counter({
  name: 'cache_misses_total',
  help: 'Cache misses by key prefix',
  labelNames: ['prefix'] as const,
  registers: [registry],
});

/** Rate-limit exceedance counter. */
export const rateLimitExceededTotal = new Counter({
  name: 'rate_limit_exceeded_total',
  help: 'Rate-limit exceedances by identity type',
  labelNames: ['identity_type'] as const,
  registers: [registry],
});

/** Background job counters / histograms. */
export const jobRunsTotal = new Counter({
  name: 'job_runs_total',
  help: 'Background job runs by job name and status',
  labelNames: ['job', 'status'] as const,
  registers: [registry],
});

export const jobDurationSeconds = new Histogram({
  name: 'job_duration_seconds',
  help: 'Background job duration in seconds',
  labelNames: ['job'] as const,
  buckets: [...DEFAULT_BUCKETS],
  registers: [registry],
});

/** Render the `/metrics` text payload. */
export async function renderMetrics(): Promise<string> {
  return registry.metrics();
}
