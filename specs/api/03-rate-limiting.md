# Rate Limiting

## Algorithm

Token bucket per identity, backed by Redis with atomic Lua. The bucket refills continuously.

## Buckets

| Identity | Rate | Burst |
|----------|------|-------|
| Integration bearer token | 3 req/s | 30 |
| Session cookie | 30 req/s | 300 |
| Anonymous IP | 1 req/s | 5 |

The bucket key incorporates the identity ID and the route bucket (some routes have stricter limits — see below).

## Stricter route buckets

| Route | Identity | Rate | Burst |
|-------|----------|------|-------|
| `POST /v1/search` | integration | 1 req/s | 5 |
| `POST /v1/databases/{id}/query` | integration | 2 req/s | 10 |
| `PATCH /v1/blocks/{id}/children` | integration | 3 req/s | 10 |
| `POST /v1/files` | integration | 1 req/s | 3 |

## Response on exceedance

```
HTTP/1.1 429 Too Many Requests
Retry-After: 3
X-RateLimit-Limit: 3
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1747339853
```

Body:

```json
{ "object": "error", "status": 429, "code": "rate_limited", "message": "Too many requests. Retry after 3 seconds.", "request_id": "..." }
```

## Bypass

- Internal jobs (worker → API) bypass the limiter via a static internal token and an allowlist check.
- Tests use a per-process limiter disable flag set via `RATE_LIMIT_DISABLE=1`.

## Observability

- `rate_limit_exceeded_total{identity_type}` counter increments on each 429.
- Log line at `warn` includes identity ID, route, token bucket remaining.
- Tests assert both metric and log emission on every chaos rate-limit scenario.