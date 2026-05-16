# API overview & conventions

## Base URL

In dev: `http://localhost:3001`. In production: whatever you've deployed behind your reverse proxy. The wire surface is identical to `api.notion.com/v1` — same paths, same payloads, same headers.

## Content type

All request and response bodies are `application/json; charset=utf-8`. The API always sets `accept: application/json` on its own clients and expects the same from yours.

For file uploads, see [Pages › attaching files](./endpoints/pages.md) — uploads go through a two-step pre-signed URL flow, not directly into the API.

## Required headers

| Header | Value | Notes |
|---|---|---|
| `Authorization` | `Bearer <token>` | Required on every `/v1/*` path except `/v1/bootstrap`, `/v1/auth/*`, `/v1/sites/*`, and public form submissions |
| `Notion-Version` | `2025-09-03` (latest) | Required. See [Versioning](./06-versioning.md) |
| `Content-Type` | `application/json` | Required on `POST`/`PATCH` with a body |

## Response headers

| Header | Notes |
|---|---|
| `Notion-Version` | Echoes the version the server resolved your request as |
| `X-Request-Id` | Per-request UUID. Quote this in support tickets |
| `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` | Per-route budget snapshot |
| `Retry-After` | Set on 429 responses, seconds until your bucket refills |

## Identifiers

All ids are UUID v4. The API accepts both the dashed form (`d3-…`) and the non-dashed form (`d3…`); responses always use dashed form. The browser-friendly page slugs that notion.so shows in URLs are *not* ids — pass the real UUID.

## Timestamps

ISO 8601 with milliseconds, UTC. `created_time` and `last_edited_time` are server-managed; do not pass them in writes.

## Object shapes

Every response (except `204 No Content`) is a JSON object with an `object` discriminator. Common values: `page`, `block`, `database`, `data_source`, `user`, `comment`, `error`, `list`, `chart_result`, `agent_run`, `ai_completion`.

For list responses:

```json
{
  "object": "list",
  "type": "page_or_database",
  "results": [...],
  "next_cursor": "abcd..." | null,
  "has_more": true | false
}
```

See [Pagination](./04-pagination.md) for the cursor protocol.

## HTTP methods

- `GET` — read. Idempotent.
- `POST` — create / invoke / search. Not idempotent unless explicitly noted.
- `PATCH` — partial update.
- `DELETE` — soft-delete by default. Permanent delete via query params on supported routes.

## Idempotency

Bloc supports an `Idempotency-Key` header on `POST` routes that create resources. If you replay a request with the same key within 24 h, the server returns the original response and does not re-create the object. Keys are scoped to the bearer token.

## Status codes

| Code | Meaning |
|---|---|
| `200 OK` | Successful read or update |
| `201 Created` | Created (where applicable; some create endpoints return 200 instead, per Notion compat) |
| `204 No Content` | Successful delete or async ack |
| `400 Bad Request` | Malformed JSON, missing field, validation failure |
| `401 Unauthorized` | Missing / invalid bearer |
| `403 Forbidden` | Authenticated but ACL says no |
| `404 Not Found` | Resource doesn't exist or is hidden by ACL |
| `409 Conflict` | Concurrent edit conflict (rare; rich-text writes mostly merge) |
| `429 Too Many Requests` | Rate-limited |
| `5xx` | Bloc bug / dependency outage. Quote `X-Request-Id` in the report |

See [Errors](./03-errors.md) for the body shape and the `code` catalogue.
