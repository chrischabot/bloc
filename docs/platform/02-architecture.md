# Architecture

A high-level map of the Bloc service stack and how requests flow through it.

## Process topology

```
                        ┌────────────────────┐
                        │   Browser (Web)    │
                        │  Next.js @ :3000   │
                        └─────────┬──────────┘
                                  │
                  REST + WS over /v1, /api/v3
                                  │
            ┌─────────────────────▼─────────────────────┐
            │              apps/api (Hono)              │
            │      :3001  /v1/*  /api/v3/*  /metrics    │
            └───┬────────┬─────────┬─────────┬──────────┘
                │        │         │         │
        ┌───────▼──┐  ┌──▼───┐  ┌──▼────┐  ┌─▼──────┐
        │ Postgres │  │Redis │  │ Meili │  │  S3    │
        │   :5432  │  │:6379 │  │ :7700 │  │ :9000  │
        └──────────┘  └──────┘  └───────┘  └────────┘
                ▲          ▲
                │          │
            ┌───┴──────────┴───┐
            │  apps/worker     │  (search indexing, exports,
            │  background jobs │   scheduled automations,
            └──────────────────┘   reminder firing, email digest)
```

Optional sidecars: **OTLP collector** at `:4317`/`:4318`, **Mailpit** at `:8025` (dev SMTP catcher).

## Each process

### `apps/api`

A Hono app. Composed of routers under `apps/api/src/routes/*.ts`, one per resource. Wired together in [`apps/api/src/server.ts`](../../apps/api/src/server.ts). Exposes:

- **`/v1/*`** — public REST API, wire-compatible with the Notion public API.
- **`/api/v3/*`** — internal recordMap API.
- **`/metrics`** — Prometheus exposition.
- **`/health`** — liveness probe.
- **WebSocket** on `/v1/realtime/ws` (auth handshake then JSON frames).

Middleware chain (top-to-bottom):

1. Request-ID stamping (`x-request-id`).
2. `notion-version` parsing.
3. Rate limiting (Redis token bucket).
4. Path-conditional auth (`/v1/bootstrap`, `/v1/auth/*`, `/v1/sites/*`, public form submit are anonymous; everything else requires a bearer).
5. Per-router business logic.
6. Centralised error handler — converts thrown `BlocAPIError`s into the Notion-style error envelope.

### `apps/web`

A Next.js 15 app (App Router) under `apps/web/app`. Talks to the API via the SDK from `@bloc/sdk`. Renders pages, the editor, database views, the sidebar, settings, AI panels, and the publishing surface.

### `apps/worker`

A long-running process under `apps/worker/src/index.ts`. Currently:

- **Email digest** — periodic batch of unread inbox entries.
- **Heartbeat** — liveness telemetry to the metrics endpoint.
- Future: search reindex backfills, scheduled automation triggers, reminder firing.

Production deployments should run one or more workers separate from the API process so request paths and background paths don't share CPU.

## Storage layer

All authoritative state lives in **Postgres**. Schema and migrations live under [`packages/db`](../../packages/db). Tables roughly mirror the public types: `workspaces`, `pages`, `blocks`, `databases`, `properties`, `comments`, `users`, `permissions`, `webhooks`, `webhook_deliveries`, `audit_events`, `analytics_events`, `reminders`, `page_versions`, etc.

**Redis** holds only ephemeral state: rate-limit buckets, realtime pub/sub fan-out, presence, idempotency keys for webhook delivery.

**MeiliSearch** is the search index. The worker keeps it in sync with Postgres via the `search_index_*` columns and the change feed.

**S3-compatible object storage** holds file uploads, page exports, and image thumbnails. In dev this is MinIO; in production it's whatever you configure with `S3_ENDPOINT` / `S3_BUCKET`.

## Request flow — anatomy of a `POST /v1/pages`

1. Browser-side SDK builds a `POST /v1/pages` with `authorization: Bearer …` and `notion-version: 2025-09-03`.
2. Hono middleware stamps a request-ID, validates the version, checks the rate-limit bucket in Redis.
3. The auth middleware loads the bearer's user/integration and attaches it to context.
4. The `pages` router validates the body with a Zod schema, opens a Postgres transaction, inserts the page row plus child blocks, emits the relevant webhook events.
5. The response handler serialises the row into the Notion-shape `PageObject`.
6. After response: an OTel span is closed, `http_requests_total` and `http_request_duration_seconds` are incremented, a structured log line is emitted with `requestId`, `route`, `status`, `durationMs`.
7. A worker picks up the search-index change and writes to MeiliSearch. A webhook delivery is dispatched async.

## Next

- [Data model](./03-data-model.md) for what the rows actually look like.
- [Realtime & sync](./06-realtime-and-sync.md) for how multiple tabs converge.
- [Self-hosting](../self-hosting/README.md) for how to run all of this on real hardware.
