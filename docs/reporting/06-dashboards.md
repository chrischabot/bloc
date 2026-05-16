# Dashboards

A starter set of Grafana dashboards. The JSON for each lives under `tools/otel/dashboards/`; this page describes what each one is for and which panels to look at first.

## 1. API overview

The top-of-funnel dashboard. Open this first when something feels wrong.

| Panel | Query |
|---|---|
| RPS by route | `sum by (route) (rate(http_requests_total[1m]))` |
| Error rate | `sum(rate(http_requests_total{status=~"5.."}[1m])) / sum(rate(http_requests_total[1m]))` |
| p50/p95/p99 latency by route | `histogram_quantile(0.95, sum by (le, route) (rate(http_request_duration_seconds_bucket[5m])))` |
| Inflight | `http_inflight_requests` |
| Eventloop lag p99 | from `nodejs_eventloop_lag_seconds_bucket` |

## 2. Database

| Panel | Query |
|---|---|
| Query duration by repository | `histogram_quantile(0.95, sum by (le, repository) (rate(db_query_duration_seconds_bucket[5m])))` |
| Pool in use vs waiting | `db_pool_in_use` and `db_pool_waiting` |
| Commit/rollback rate | `rate(db_transactions_total[1m])` by `result` |

## 3. Realtime

| Panel | Query |
|---|---|
| Active connections | `ws_connections_active` |
| Op throughput | `rate(ws_messages_total{direction="in",kind="op"}[1m])` |
| Op latency p95 | from `ws_message_duration_seconds_bucket` |
| Rejections | `rate(ws_op_rejections_total[1m])` |

## 4. Search

| Panel | Query |
|---|---|
| Index lag | `search_index_lag_seconds` |
| Query latency | `histogram_quantile(0.95, rate(search_query_duration_seconds_bucket[5m]))` |
| Write rate | `rate(search_index_writes_total[1m])` |

## 5. Workers

| Panel | Query |
|---|---|
| Job rate by kind | `rate(worker_jobs_total[1m])` |
| Job failure rate | `rate(worker_jobs_total{result="failed"}[1m]) / rate(worker_jobs_total[1m])` |
| Queue depth | `worker_queue_depth` |

## 6. Webhooks

| Panel | Query |
|---|---|
| Delivery success / fail | `rate(webhook_delivery_attempts_total[1m])` by `result` |
| Latency p95 | `histogram_quantile(0.95, rate(webhook_delivery_duration_seconds_bucket[5m]))` |
| Pending queue | `webhook_delivery_pending` |
| Top failure-streak | `topk(10, webhook_failure_streak)` |

## 7. AI

| Panel | Query |
|---|---|
| Requests by surface | `rate(ai_requests_total[1m])` by `surface` |
| Latency by surface | `histogram_quantile(0.95, rate(ai_request_duration_seconds_bucket[5m]))` by `surface` |
| Token in/out | `rate(ai_tokens_in_total[1m])`, `rate(ai_tokens_out_total[1m])` |

## 8. Rate limits

| Panel | Query |
|---|---|
| Exceeded by route | `rate(rate_limit_exceeded_total[5m])` by `route` |
| Top noisy identities | `topk(10, sum by (identity) (rate(rate_limit_exceeded_total[5m])))` |

## Importing

```bash
for f in tools/otel/dashboards/*.json; do
  curl -X POST -H "Authorization: Bearer $GRAFANA_TOKEN" \
       -H "Content-Type: application/json" \
       --data-binary @$f \
       http://grafana:3000/api/dashboards/db
done
```
