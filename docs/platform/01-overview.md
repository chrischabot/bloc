# Overview

Bloc is a self-hostable, open-source workspace that treats every page as a tree of blocks and every database as a queryable view over structured properties. It's API-compatible with Notion — the official `@notionhq/client` and existing integrations work against a Bloc server without modification.

## What Bloc gives you

- **Block editor**, 38 block types: paragraph, headings, lists, toggles, callouts, quotes, code, equations, images, video, files, bookmarks, embeds, tables, columns, dividers, table-of-contents, breadcrumbs, link-to-page, synced blocks, templates, child pages, child databases, and more.
- **Databases**, 23 property types across **six** view types (table, board, list, gallery, calendar, timeline) with filters, sorts, grouping, formulas, rollups, and relations.
- **Realtime collaboration** over WebSockets with multi-tab convergence, offline queue + replay, and presence.
- **Search** backed by MeiliSearch — full-text and structured queries.
- **Sharing & permissions** — workspaces, groups, page-level ACLs, public links, guest invites, OAuth apps.
- **Comments, mentions, reminders, version history.**
- **Automations, buttons, forms, charts, sub-items, dependencies.**
- **AI surfaces** — Writer, Q&A, Agent, Autofill, Meeting Notes — over a pluggable LLM provider.
- **Public REST API** at `/v1/*` (wire-compatible with `api.notion.com/v1`).
- **Internal v3 API** at `/api/v3/*` that emits a `recordMap` compatible with `<NotionRenderer/>` from `react-notion-x`.
- **Webhooks, sites publishing, calendar, mail-style inbox, third-party connections, audit log, analytics.**

## What Bloc is not

- It is not a hosted product. You run it.
- The AI surfaces are not parity with Notion AI in *quality* — answer quality is a function of the LLM provider you point at. Bloc only promises the *shape* of those surfaces.
- The internal v3 API tracks a moving target. Bloc emits a recordMap that `react-notion-x` can render, but byte-for-byte conformance with `www.notion.so/api/v3` is explicitly **not** a goal.

## Stack

- TypeScript end to end.
- **API server** — [Hono](https://hono.dev) on Node 22.
- **Web app** — Next.js 15 (App Router).
- **Worker** — long-running Node process for search indexing, exports, scheduled automations, reminder firing.
- **Postgres 16** for everything authoritative.
- **Redis 7** for rate limiting, pub/sub, ephemeral state.
- **MeiliSearch 1.10** for search.
- **S3-compatible** object storage (MinIO in dev) for file uploads.
- **OpenTelemetry** for traces, **Prometheus** for metrics, **OTLP collector** in the middle.

## Repository layout

```
apps/
  api/          REST + WebSocket server
  web/          Next.js 15 frontend
  worker/       Background jobs
packages/
  ai/           Provider-agnostic LLM interface
  db/           Postgres schema + migrations
  observability/ OpenTelemetry + Prometheus wiring
  sdk/          First-party TypeScript SDK
  shared/       Types, validators, block & property schemas
  ui/           Design-system components
tools/
  benchmark/    p50/p99 harness
  otel/         Collector config
tests/
  contract/     API contract tests
  sdk-progressive/  SDK conformance tests
  e2e/          Playwright
  visual/       Visual regression
  chaos/        Malformed / adversarial inputs
specs/          Build specification (the original plan)
docs/           User & developer documentation (you are here)
```

## Where to go next

- Run it locally: [Quickstart](../guides/01-quickstart.md) or [Self-hosting](../self-hosting/01-getting-started.md).
- Learn the data model: [Data model](./03-data-model.md).
- Call the API: [REST API reference](../api/README.md).
- Use the SDK: [SDK reference](../sdk/README.md).
