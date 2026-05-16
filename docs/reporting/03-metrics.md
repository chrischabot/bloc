# Metrics

Exposed at `GET /metrics` on the API (port `3001`) and the worker (port `3002`). Prometheus exposition format.

Convention: `<domain>_<unit>` snake_case. `_total` suffix on counters; `_seconds` / `_bytes` for unit-bearing metrics.

## HTTP

| Metric | Type | Labels |
|---|---|---|
| `http_requests_total` | counter | `method`, `route`, `status` |
| `http_request_duration_seconds` | histogram | `method`, `route` |
| `http_inflight_requests` | gauge | `route` |

## WebSocket

| Metric | Type | Labels |
|---|---|---|
| `ws_connections_active` | gauge | |
| `ws_messages_total` | counter | `direction` (`in`/`out`), `kind` |
| `ws_message_duration_seconds` | histogram | `kind` |
| `ws_op_rejections_total` | counter | `reason` |

## Postgres

| Metric | Type | Labels |
|---|---|---|
| `db_query_duration_seconds` | histogram | `repository`, `operation` |
| `db_pool_in_use` | gauge | |
| `db_pool_waiting` | gauge | |
| `db_transactions_total` | counter | `result` (`commit`/`rollback`) |

## Cache (Redis)

| Metric | Type | Labels |
|---|---|---|
| `cache_hits_total` | counter | `prefix` |
| `cache_misses_total` | counter | `prefix` |
| `cache_evictions_total` | counter | `prefix` |

## Search

| Metric | Type |
|---|---|
| `search_index_lag_seconds` | gauge |
| `search_index_writes_total` | counter |
| `search_query_duration_seconds` | histogram |

## Rate limit

| Metric | Type | Labels |
|---|---|---|
| `rate_limit_exceeded_total` | counter | `identity_type`, `route` |
| `rate_limit_bucket_remaining` | gauge | `identity`, `bucket` |

## Jobs / worker

| Metric | Type | Labels |
|---|---|---|
| `worker_jobs_total` | counter | `kind`, `result` |
| `worker_job_duration_seconds` | histogram | `kind` |
| `worker_queue_depth` | gauge | `kind` |
| `worker_leader_elections_total` | counter | |

## Webhooks

| Metric | Type | Labels |
|---|---|---|
| `webhook_delivery_attempts_total` | counter | `result` |
| `webhook_delivery_duration_seconds` | histogram | |
| `webhook_delivery_pending` | gauge | |
| `webhook_failure_streak` | gauge | `webhook_id` |

## AI

| Metric | Type | Labels |
|---|---|---|
| `ai_requests_total` | counter | `surface`, `model`, `result` |
| `ai_request_duration_seconds` | histogram | `surface`, `model` |
| `ai_tokens_in_total` | counter | `surface` |
| `ai_tokens_out_total` | counter | `surface` |

## Reminders

| Metric | Type | Labels |
|---|---|---|
| `reminders_fired_total` | counter | |
| `reminders_pending` | gauge | |

## Process

Standard Node process metrics from `prom-client`:

- `nodejs_eventloop_lag_seconds`
- `nodejs_heap_size_total_bytes`
- `nodejs_heap_size_used_bytes`
- `process_cpu_user_seconds_total`
- `process_resident_memory_bytes`

## PromQL recipes

```promql
# API p95 latency by route
histogram_quantile(0.95, sum by (le, route) (rate(http_request_duration_seconds_bucket[5m])))

# 5xx rate (per second)
sum(rate(http_requests_total{status=~"5.."}[1m]))

# Search lag
search_index_lag_seconds

# Webhook delivery failure rate
sum(rate(webhook_delivery_attempts_total{result="failed"}[5m]))
  / sum(rate(webhook_delivery_attempts_total[5m]))

# Eventloop lag (a node-process health check)
histogram_quantile(0.99, sum by (le, service) (rate(nodejs_eventloop_lag_seconds_bucket[5m])))
```
