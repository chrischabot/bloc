# Architecture Overview

## System diagram (logical)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Browser (Next.js)                              │
│  ┌──────────────┐  ┌─────────────────┐  ┌───────────────────────────────┐   │
│  │ App Shell    │  │ Block Editor    │  │ Database Views                │   │
│  │ (sidebar,    │  │ (rich text,     │  │ (table, board, gallery,       │   │
│  │ breadcrumb)  │  │ slash menu)     │  │ list, calendar, timeline)     │   │
│  └──────┬───────┘  └────────┬────────┘  └──────────────┬────────────────┘   │
│         │                   │                          │                    │
│         └───────────────────┴──────────────┬───────────┘                    │
│                                            │                                │
│                                ┌───────────▼──────────┐                     │
│                                │  First-party SDK     │                     │
│                                │  packages/sdk        │                     │
│                                └───────────┬──────────┘                     │
└────────────────────────────────────────────┼────────────────────────────────┘
                                             │ HTTPS + WSS
┌────────────────────────────────────────────▼────────────────────────────────┐
│                              Edge / CDN                                     │
│         (static assets, image transforms, geo-routing)                      │
└────────────────────────────────────────────┬────────────────────────────────┘
                                             │
┌────────────────────────────────────────────▼────────────────────────────────┐
│                         API Gateway (apps/api)                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ REST router │  │ WS gateway   │  │ Rate limit   │  │ AuthN / AuthZ   │   │
│  │ (Hono/Fastify)│ │ (Yjs sync)  │  │ (Redis)      │  │ (JWT, OAuth)    │   │
│  └─────┬───────┘  └──────┬───────┘  └──────────────┘  └─────────────────┘   │
│        │                 │                                                  │
│        ▼                 ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Service Layer (use-cases)                        │    │
│  │  pages · blocks · databases · query/filter/sort engine · search ·   │    │
│  │  comments · users · permissions · realtime · search-indexer        │    │
│  └─────┬────────────────┬───────────────┬───────────────┬──────────────┘    │
└────────┼────────────────┼───────────────┼───────────────┼───────────────────┘
         │                │               │               │
         ▼                ▼               ▼               ▼
   ┌──────────┐    ┌──────────┐     ┌──────────┐    ┌──────────┐
   │ Postgres │    │  Redis   │     │MeiliSearch│   │ S3 / R2  │
   │ (primary)│    │ (cache,  │     │ (FTS)    │    │ (files)  │
   │          │    │  RL, pub │     │          │    │          │
   │          │    │   /sub)  │     │          │    │          │
   └──────────┘    └──────────┘     └──────────┘    └──────────┘
                                             ▲
                                             │
                                ┌────────────┴───────────┐
                                │     Worker             │
                                │  (apps/worker)         │
                                │  - search indexer      │
                                │  - rollup recompute    │
                                │  - email notifications │
                                │  - exports             │
                                └────────────────────────┘
                                             ▲
                                             │
                                ┌────────────┴───────────┐
                                │  Observability         │
                                │  (OTEL → Tempo/Loki    │
                                │   /Prometheus/Grafana) │
                                └────────────────────────┘
```

## Major components

| Component | Purpose | Tech |
|-----------|---------|------|
| `apps/web` | User-facing app, server components + client interactivity, identical UI to notion.so | Next.js 15 (App Router), React 19 |
| `apps/api` | REST + WebSocket gateway implementing the Notion API surface | Hono on Node 22 (or Bun; see tech-stack doc) |
| `apps/worker` | Background jobs: search indexing, rollup recompute, exports, email, deletion sweep | Node 22 + BullMQ on Redis |
| `packages/db` | Schema, migrations, repository layer | Drizzle ORM + Postgres 16 |
| `packages/sdk` | First-party SDK mirroring `@notionhq/client` shape | TypeScript |
| `packages/editor` | Block-tree rich-text editor | TypeScript + Yjs |
| `packages/ui` | Design system | React + CSS modules + Tailwind tokens |
| `packages/observability` | OTEL setup, logger, metrics | OpenTelemetry SDK + pino |
| `packages/shared` | Block/property schemas (Zod), error types, version constants | TypeScript |

## Request flow (read path)

1. Browser issues `GET /v1/blocks/{id}/children?page_size=50` via the SDK.
2. Edge forwards to API gateway; gateway terminates TLS, authenticates the bearer token, checks rate limit in Redis.
3. Router maps to the `blocks.children.list` use-case.
4. Use-case asks `packages/db` for children where `parent_id = id` ordered by `position`; cursor decoded to `(position, id)`.
5. Authorization filter applies page-level permission scope.
6. Result serialized via shared schema (Zod → JSON), wrapped in `{object: "list", results, next_cursor, has_more}`.
7. Span closes with `block.id`, `count`, `latency_ms`; metric `http_request_duration_ms` incremented.

## Request flow (write path with realtime)

1. Browser sends `PATCH /v1/blocks/{id}/children` (append).
2. Use-case validates payload, opens a write transaction.
3. Children inserted with fractional positions; the page's `last_edited_*` columns bumped.
4. Postgres `LISTEN/NOTIFY` (or Redis pub/sub) fans out a `block.appended` event keyed by page.
5. WS gateway delivers the event to every subscribed client on that page.
6. Worker consumes the event for search re-indexing.
7. Response returned with the created blocks.

## Non-functional targets

| Target | Budget |
|--------|--------|
| API p99 read | < 150 ms |
| API p99 write (single block) | < 200 ms |
| API p99 query (10k-row DB, 3-clause filter) | < 250 ms |
| WS keystroke ack p99 | < 80 ms |
| Frontend INP | < 200 ms |
| Page open (1000 blocks, cold) | < 1500 ms |
| Page open (1000 blocks, warm) | < 400 ms |
| Lighthouse perf | ≥ 90 |
| Availability target | 99.9% |

See `docs/testing/08-benchmarks.md` for the full budget table.