# Errors

## Shape

```jsonc
{
  "object": "error",
  "status": 400,
  "code": "invalid_request",
  "message": "Human-readable explanation.",
  "request_id": "req_2c3f8d0e",
  "details": [
    { "path": "properties.title", "issue": "expected rich_text array" }
  ]
}
```

- `status` = HTTP status code (also reflected in the actual HTTP status line).
- `code` = machine-readable enum from the table below.
- `message` = human-readable; safe to surface to end users but not localised.
- `request_id` = always present; the same string is in logs and traces.
- `details` = optional structured per-field issues (Zod-derived).

## Codes

| HTTP | Code | When |
|------|------|------|
| 400 | `invalid_request` | Malformed JSON, unknown field, wrong type, missing required |
| 400 | `invalid_cursor` | Bad/expired pagination cursor |
| 400 | `invalid_grant_type` | OAuth |
| 400 | `validation_error` | Specific business validation (e.g. rollup target not relation) |
| 401 | `unauthorized` | Missing/invalid bearer token or session |
| 402 | `restricted_resource` | Plan limit hit |
| 403 | `restricted_resource` | Permission denied |
| 404 | `object_not_found` | Resource missing OR no permission to know it exists |
| 409 | `conflict_error` | Idempotency key mismatch; concurrent edit collision |
| 415 | `unsupported_media_type` | Wrong Content-Type |
| 422 | `unprocessable_entity` | Semantically invalid (e.g. circular relation) |
| 429 | `rate_limited` | Token bucket empty; respect `Retry-After` |
| 500 | `internal_server_error` | Unhandled exception |
| 502 | `bad_gateway` | Upstream failure (S3, MeiliSearch) |
| 503 | `service_unavailable` | Maintenance / degraded |
| 504 | `gateway_timeout` | Upstream timeout |

## Hiding existence

We follow Notion's convention: a 403 leaks existence; if the caller cannot read the resource and is not allowed to know it exists, return `404 object_not_found`. This decision lives in `packages/db/src/permissions.ts#resolveVisibility`.

## Server errors

5xx responses MUST NOT leak stack traces, SQL fragments, or internal hostnames. The `details` field is omitted on 5xx. The full stack is logged with the `request_id`.

## Test obligations

- Every endpoint has a chaos test that hits the validation, auth, permission, not-found, and rate-limited paths and asserts on the JSON shape exactly.