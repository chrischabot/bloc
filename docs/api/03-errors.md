# Errors

## Envelope

Every non-2xx response is a JSON object with this shape:

```json
{
  "object": "error",
  "status": 404,
  "code": "object_not_found",
  "message": "Could not find page abc123",
  "request_id": "01J5QP…"
}
```

| Field | Notes |
|---|---|
| `object` | Always `"error"` |
| `status` | HTTP status — mirrors the response status code |
| `code` | Machine-readable, from the catalogue below |
| `message` | Human-readable; safe to surface to end users |
| `request_id` | UUID; matches `X-Request-Id`. Quote this in support tickets |

## Code catalogue

| `code` | HTTP | When |
|---|---|---|
| `invalid_request` | 400 | Malformed JSON, missing required field, type error |
| `invalid_request_url` | 400 | URL pattern doesn't match a known route |
| `validation_error` | 400 | Body parsed but failed schema validation |
| `missing_version` | 400 | `Notion-Version` header absent |
| `unsupported_version` | 400 | `Notion-Version` value not recognised |
| `unauthorized` | 401 | Bearer missing or invalid |
| `restricted_resource` | 403 | Bearer is valid but ACL denies the requested action |
| `insufficient_scope` | 403 | Token lacks the scope this endpoint needs |
| `object_not_found` | 404 | No such resource (or ACL-hidden) |
| `conflict_error` | 409 | Concurrent edit lost; retry with fresh state |
| `rate_limited` | 429 | Bucket exhausted; see `Retry-After` |
| `internal_server_error` | 500 | A bug. Quote `request_id` |
| `service_unavailable` | 503 | Dependency outage (Postgres, Redis, Meili, …) |
| `database_connection_unavailable` | 503 | Postgres unreachable specifically |

## Status mapping

The status code is always set; the `code` further disambiguates. If you only know the HTTP status, expect:

- `400` → `invalid_request`, `validation_error`, `missing_version`
- `401` → `unauthorized`
- `403` → `restricted_resource`, `insufficient_scope`
- `404` → `object_not_found`
- `429` → `rate_limited`
- `5xx` → `internal_server_error`, `service_unavailable`

## Error handling recipe

```ts
import { BlocAPIError, BlocAuthError, BlocNotFoundError, BlocRateLimitError } from '@bloc/sdk';

try {
  await bloc.pages.retrieve({ page_id });
} catch (err) {
  if (err instanceof BlocNotFoundError) return null;
  if (err instanceof BlocAuthError) return signInAgain();
  if (err instanceof BlocRateLimitError) {
    await sleep(err.retryAfter * 1000);
    return retry();
  }
  if (err instanceof BlocAPIError) {
    logger.error({ code: err.code, requestId: err.requestId }, err.message);
  }
  throw err;
}
```

The SDK already retries on 429 and 5xx with exponential backoff up to `maxRetries`; you only see the exception if retries are exhausted.

## Validation errors

`validation_error` responses include a `details` array describing each failing field:

```json
{
  "object": "error",
  "status": 400,
  "code": "validation_error",
  "message": "Validation failed for 2 fields",
  "request_id": "...",
  "details": [
    { "path": ["properties", "Name", "title", 0, "text", "content"], "issue": "expected string" },
    { "path": ["parent", "page_id"], "issue": "not a valid uuid" }
  ]
}
```

## Webhooks errors

For delivery failures Bloc retries with backoff and stores the failure history at `/v1/webhooks/{id}/deliveries`. After 20 consecutive failures the webhook is disabled (`enabled: false`).
