# Rate limiting

Bloc's rate-limit budgets and headers are documented in [API › Rate limiting](../api/05-rate-limiting.md). This page covers what to **monitor**.

## Metrics

| Metric | Watch for |
|---|---|
| `rate_limit_exceeded_total{identity_type="bearer",route="..."}` | Rapid rise = an integration is misbehaving |
| `rate_limit_exceeded_total{identity_type="ip"}` | Rapid rise = a public form / bootstrap is being abused |
| `rate_limit_bucket_remaining` | A bucket dropping toward 0 for a single identity |

## Reasonable alert thresholds

```yaml
- alert: BlocRateLimitSpike
  expr: rate(rate_limit_exceeded_total[5m]) > 5
  for: 5m
  annotations:
    summary: "Rate-limit hits spiking on {{ $labels.route }}"

- alert: BlocIPAbuse
  expr: sum by (identity) (rate(rate_limit_exceeded_total{identity_type="ip"}[1m])) > 10
  for: 2m
  annotations:
    summary: "Single IP is hitting rate limits aggressively"
```

## How to react

1. **Pull up `rate_limit_exceeded_total` by route** — which endpoint is being hit?
2. **By identity** — is it one bearer or a spread? One bearer = misbehaving client; broad spread = either a real spike or a buggy load test.
3. If a single bearer, look at their request pattern in the access log. Common culprits: polling instead of webhooks, missing `start_cursor`/`has_more` (re-fetching page 1 in a loop), retrying on 4xx when they should fix the request.
4. Reach out, or raise their `rate_limit_multiplier` if their use is legitimate.

## Configuration knobs

| Var | Default | Notes |
|---|---|---|
| `RATE_LIMIT_DISABLE` | `0` | Set to `1` to disable. Benchmark / dev only. |
| `RATE_LIMIT_OVERRIDE_PATH` | (empty) | Comma-separated routes to relax |
| `RATE_LIMIT_MULTIPLIER_DEFAULT` | `1` | Globally scale every bucket |

Per-bearer multipliers live on the integration row in the DB; set them via the admin UI or `PATCH /v1/integrations/{id}`.
