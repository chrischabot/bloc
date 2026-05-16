# Rate limiting

Bloc rate-limits per **identity** — per bearer token, or per IP for unauthenticated routes.

## Budgets

| Bucket | Burst | Sustained | Window |
|---|---|---|---|
| Default (most `/v1/*`) | 30 req | 3 req/s | 10 s |
| `POST /v1/search` | 6 req | 1 req/s | 10 s |
| `POST /v1/ai/*` | 6 req | 1 req/s | 60 s |
| `POST /v1/databases/{id}/query` | 18 req | 2 req/s | 10 s |
| `POST /v1/analytics/beacon` | 200 req | 20 req/s | 10 s |
| Anonymous (`/v1/bootstrap`, `/v1/auth/code/request`, public form submit) | 10 req | 1 req/s | 60 s per IP |

Buckets are token-bucket with the listed burst capacity, refilling at the sustained rate.

Disable entirely in dev with `RATE_LIMIT_DISABLE=1`.

## Headers

Every response includes:

| Header | Notes |
|---|---|
| `RateLimit-Limit` | Bucket capacity (burst) |
| `RateLimit-Remaining` | Tokens left after this request |
| `RateLimit-Reset` | Seconds until full refill |

On a 429:

| Header | Notes |
|---|---|
| `Retry-After` | Seconds you should wait before retrying |

Response body:

```json
{
  "object": "error",
  "status": 429,
  "code": "rate_limited",
  "message": "Rate limit exceeded for bearer abc…",
  "request_id": "...",
  "retry_after": 3
}
```

## SDK behaviour

The Bloc SDK and `@notionhq/client` both retry 429 responses with exponential backoff (honouring `Retry-After`). You typically don't have to handle 429 yourself unless retries are exhausted.

## Going beyond the limits

For workspaces with legitimate higher needs:

- Server-side, set `RATE_LIMIT_OVERRIDE_PATH=<comma list>` to relax buckets on specific routes.
- Per-token, set `bot.rate_limit_multiplier` in the workspace settings (admin only). Multiplies the bucket size for that bearer.

Don't disable rate-limiting in production. The buckets exist to keep Postgres and the search index responsive.

## Metrics

| Metric | Type | Labels |
|---|---|---|
| `rate_limit_exceeded_total` | counter | `identity_type` (`bearer`, `ip`), `route` |
| `rate_limit_bucket_remaining` | gauge | `identity`, `bucket` |

Alert on `rate_limit_exceeded_total` rising sharply — it's a signal that an integration is misbehaving or that you need to raise a multiplier.
