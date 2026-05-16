# API Overview

The API mirrors `developers.notion.com/reference`. All conventions below match Notion's production API unless explicitly noted.

## Base URL

```
https://api.<our-domain>/v1
```

The `/v1` segment is permanent. Future breaking changes ride on the `Notion-Version` request header.

## Content type

- Requests: `application/json` for bodies. `multipart/form-data` only for the file pre-sign-upload finalisation hop.
- Responses: `application/json; charset=utf-8`.
- All numbers are JSON numbers (no string encoding).
- All timestamps are ISO 8601 strings (`2026-05-15T19:15:00.000Z`).
- All durations in API payloads are seconds (integer or float).

## Required headers

| Header | Value | Required for |
|--------|-------|--------------|
| `Authorization` | `Bearer secret_...` or session cookie | All non-public endpoints |
| `Notion-Version` | `2026-04-01` (current baseline; see `docs/api/05-versioning.md` for the full version matrix and back-compat policy) | All requests |
| `Content-Type` | `application/json` | Requests with body |
| `Idempotency-Key` | UUID string (optional) | `POST` and `PATCH` write endpoints; deduplicates retries within 24h |

Unknown `Notion-Version` values return `400 invalid_request`.

## Response envelope (single object)

```jsonc
{
  "object": "page" | "database" | "block" | "user" | "comment" | "list" | "error",
  "id": "uuid",
  // ...type-specific fields
}
```

Every top-level response has `object` and (when applicable) `id`. The `object` field is normative — clients dispatch on it.

## Response envelope (lists)

```jsonc
{
  "object": "list",
  "results": [ /* objects */ ],
  "next_cursor": "string|null",
  "has_more": true|false,
  "type": "block" | "page_or_database" | "user" | "comment" | "property_item",
  // ...optional type-specific metadata
}
```

## Pagination

- Cursor-based only.
- Request: `?start_cursor=...&page_size=...`.
- `page_size` default 100; max 100; minimum 1.
- Cursors are opaque base64url-encoded strings; treat as black boxes on the client.
- See `docs/api/01-pagination.md`.

## Idempotency

`Idempotency-Key` is honoured on `POST` and `PATCH` endpoints. The first response is cached in Redis for 24 hours keyed by `(integration_id|session_id, route, idempotency_key)`. Retries with the same key replay the cached response, including its status code. Mismatched payloads with the same key return `409 conflict`.

## Versioning

- The complete supported version matrix lives in `docs/api/05-versioning.md`.
- Current baseline: `2026-04-01`.
- Older versions remain supported per the deprecation overlap policy (≥ 12 months after a new baseline ships).
- The supported set is materialised in `packages/shared/src/version.ts` as the single source of truth.
- Unknown / unsupported versions return `400 invalid_request` with detail `unsupported_version`.

## Object IDs

- All resource IDs are UUID v4 strings, hyphenated. Sample: `2c3f8d0e-7f5a-4f9a-9b9f-1c2d3e4f5a6b`.
- API accepts both hyphenated and unhyphenated forms on input; output always hyphenated.

## Timestamps

- ISO 8601 in UTC with millisecond precision and trailing `Z`.
- `created_time` and `last_edited_time` are server-assigned and never accepted from clients.

## CORS

- `Access-Control-Allow-Origin`: configurable per integration, default `*` for public reads, echoed origin for credentialed routes.
- Preflight cached 86400s.

## Errors

See `docs/api/02-errors.md`.

## Rate limiting

See `docs/api/03-rate-limiting.md`.

## Idempotent reads

All `GET` endpoints are safe and idempotent. They return the same `ETag` for unchanged resources. Clients may send `If-None-Match` to receive `304`.

## Standard response headers

Returned on every response (added in baseline `2026-04-01`):

| Header | Meaning |
|--------|---------|
| `X-Request-Id` | Echoed in logs and traces; always present |
| `X-RateLimit-Limit` | Bucket size for the calling identity |
| `X-RateLimit-Remaining` | Remaining tokens at response time |
| `X-RateLimit-Reset` | Unix-epoch seconds when the bucket fully refills |
| `Notion-Version` | The version the response was generated under |
| `Deprecation` | `true` when the request used a non-current version |
| `Sunset` | Present when the requested version is within 90 days of removal |