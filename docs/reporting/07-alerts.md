# Alerts

A starter set. Tune the thresholds for your traffic shape before going on-call.

## P1 (page someone immediately)

```yaml
- alert: BlocApiDown
  expr: up{job="bloc-api"} == 0
  for: 1m
  annotations:
    summary: "Bloc API replica down"
    runbook: "https://docs/your-runbook"

- alert: Bloc5xxRate
  expr: sum(rate(http_requests_total{job="bloc-api",status=~"5.."}[5m])) > 1
  for: 5m
  annotations:
    summary: "5xx rate > 1/s on Bloc API"

- alert: BlocDbUnreachable
  expr: increase(db_transactions_total{result="rollback"}[5m]) > 50
  for: 5m

- alert: BlocEventLoopLag
  expr: histogram_quantile(0.99, sum by (le, service) (rate(nodejs_eventloop_lag_seconds_bucket[5m]))) > 0.5
  for: 5m
```

## P2 (degraded but not down)

```yaml
- alert: BlocApiSlow
  expr: histogram_quantile(0.95, sum by (le, route) (rate(http_request_duration_seconds_bucket[5m]))) > 1.5
  for: 10m

- alert: BlocSearchLag
  expr: search_index_lag_seconds > 60
  for: 10m

- alert: BlocWebhookFailures
  expr: |
    sum(rate(webhook_delivery_attempts_total{result="failed"}[5m]))
      / sum(rate(webhook_delivery_attempts_total[5m])) > 0.1
  for: 15m

- alert: BlocWorkerQueueGrowing
  expr: deriv(worker_queue_depth[15m]) > 0.5
  for: 30m
```

## P3 (warning)

```yaml
- alert: BlocRateLimitSpike
  expr: rate(rate_limit_exceeded_total[5m]) > 5
  for: 10m

- alert: BlocDbPoolSaturated
  expr: db_pool_waiting > 5
  for: 5m

- alert: BlocCertExpiring
  expr: (probe_ssl_earliest_cert_expiry - time()) / 86400 < 14
```

## Synthetic checks

Beyond metric-based alerts, run synthetic checks against:

- `GET /health` — every minute.
- `GET /v1/users/me` with a known bearer — every minute. Verifies auth path.
- A reference `POST /v1/pages` + `DELETE` round-trip — every 5 min. Verifies write path.

Probe the WebSocket too if you can — `wscat -c wss://your-host/v1/realtime/ws?token=…` with a 1-second body should return a `hello` frame.
