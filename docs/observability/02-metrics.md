# Metrics

## Tool

`prom-client` exposed at `GET /metrics` (mTLS or basic auth in prod; open in dev).

## Naming

`<domain>_<unit>` snake_case, suffix `_total` for counters, `_seconds` / `_bytes` for units.

## Catalogue

### HTTP

| Metric | Type | Labels |
|--------|------|--------|
| `http_requests_total` | counter | `method`, `route`, `status` |
| `http_request_duration_seconds` | histogram | `method`, `route` |
| `http_inflight_requests` | gauge | `route` |

### WS

| Metric | Type | Labels |
|--------|------|--------|
| `ws_connections_active` | gauge | |
| `ws_messages_total` | counter | `direction` (`in`/`out`), `kind` |
| `ws_message_duration_seconds` | histogram | `kind` |

### DB

| Metric | Type | Labels |
|--------|------|--------|
| `db_query_duration_seconds` | histogram | `repository`, `operation` |
| `db_pool_in_use` | gauge | |
| `db_pool_waiting` | gauge | |

### Cache

| Metric | Type | Labels |
|--------|------|--------|
| `cache_hits_total` | counter | `prefix` |
| `cache_misses_total` | counter | `prefix` |

### Search

| Metric | Type |
|--------|------|
| `search_index_lag_seconds` | gauge |
| `search_index_writes_total` | counter |

### Rate limit

| Metric | Type | Labels |
|--------|------|--------|
| `rate_limit_exceeded_total` | counter | `identity_type` |

### Jobs

| Metric | Type | Labels |
|--------|------|--------|
| `job_runs_total` | counter | `job`, `status` (`success`/`failure`) |
| `job_duration_seconds` | histogram | `job` |

### Frontend (server-aggregated from telemetry events)

| Metric | Type | Labels |
|--------|------|--------|
| `web_vitals_seconds` | histogram | `metric` (`lcp`/`inp`/`cls`/`fid`/`ttfb`) |
| `web_event_total` | counter | `event` |

## Histogram buckets

Default seconds: `[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]`. Override per-metric where ranges differ markedly.

## Validation

`assertCounterIncrement(name, labels, by)` and `assertHistogramObserved(name, labels, atLeast)` helpers ensure tests exercise metrics.

## Cardinality

Avoid high-cardinality labels (no user IDs as labels, no full URLs). Routes are templates (`/v1/blocks/:id`).