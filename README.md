# Bloc

A faithful reimplementation of Notion — open source, self-hostable, and wire-compatible with the official Notion API.

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)

---

## Why Bloc

Block-based document tools have become essential infrastructure — for note-taking, project planning, wikis, lightweight databases, internal tools, and team knowledge. Bloc is an open-source workspace built around the same model: every page is a tree of blocks, every database is a queryable view over structured properties, every change is collaborative and versioned.

Bloc was built to give that workflow a home you actually control:

- **Run it yourself.** Postgres, Redis, MeiliSearch, S3-compatible storage. Docker Compose brings the whole stack up locally.
- **Use the SDK you already know.** The REST surface at `/v1/*` is wire-compatible with the public Notion API, so the official `@notionhq/client` works against your Bloc server unmodified. Existing scripts, integrations, and SDKs keep working.
- **Own the data.** Your blocks live in your Postgres. Export, query, back up, migrate — there's no opaque backend you can't reach.
- **Extend it.** The full stack is TypeScript, the schema is documented, and every feature surface has a spec under [`docs/`](./docs/).

## What's in the box

- **Block editor** — 38 block types (paragraph, heading, list, toggle, callout, quote, code, equation, image, video, file, bookmark, embed, table, column, divider, table-of-contents, breadcrumb, link-to-page, synced-block, template, child-page, child-database, …)
- **Databases** — 23 property types, six view types (table, board, list, gallery, calendar, timeline), filters, sorts, grouping, formulas, rollups, relations
- **Realtime sync** — WebSocket-backed multi-tab convergence, offline queue + replay, presence
- **Search** — MeiliSearch-backed full-text + structured query
- **Sharing & permissions** — Workspaces, groups, page-level ACLs, public links, guest invites, OAuth
- **Comments, mentions, reminders, version history**
- **Automations, buttons, forms, charts, sub-items & dependencies**
- **AI surfaces** — Writer, Q&A, Agent, Autofill, Meeting Notes (LLM provider configurable)
- **Public REST API** at `/v1/*` (wire-compatible with the public Notion API)
- **Internal v3 API** at `/api/v3/*` — `recordMap` shape consumable by `<NotionRenderer/>` from `react-notion-x`
- **Webhooks, sites publishing, calendar, mail, connections, audit log, analytics**

## Getting started

### Prerequisites

- Node.js ≥ 22
- pnpm ≥ 10
- Docker + Docker Compose (for the local service stack)

### Install

```bash
git clone https://github.com/chrischabot/bloc.git
cd bloc
pnpm install
cp .env.example .env
```

### Bring up the service stack

```bash
docker compose up -d        # postgres, redis, meilisearch, minio, mailpit, otel-collector
pnpm db:migrate
pnpm db:seed
```

### Run it

```bash
pnpm dev
```

That starts everything in parallel:

- **Web** — http://localhost:3000
- **API** — http://localhost:3001 (REST at `/v1/*`, internal v3 at `/api/v3/*`)
- **Worker** — background jobs (search indexing, exports, scheduled automations)

The first time you load the web app it provisions a workspace and a dev bearer token automatically.

## Using the SDK

Bloc ships its own first-party TypeScript SDK at `@bloc/sdk`, but the public API surface is wire-compatible with `@notionhq/client`, so either works.

### With `@bloc/sdk`

```ts
import { Bloc } from '@bloc/sdk';

const bloc = new Bloc({
  auth: process.env.BLOC_TOKEN,
  baseUrl: 'http://localhost:3001',
});

const page = await bloc.pages.create({
  parent: { workspace: true },
  properties: { title: { title: [{ text: { content: 'Hello, Bloc' } }] } },
});

await bloc.blocks.children.append({
  block_id: page.id,
  children: [
    { paragraph: { rich_text: [{ text: { content: 'First block.' } }] } },
  ],
});

const results = await bloc.search({ query: 'Hello' });
```

### With the official `@notionhq/client`

```ts
import { Client } from '@notionhq/client';

const notion = new Client({
  auth: process.env.BLOC_TOKEN,
  baseUrl: 'http://localhost:3001',   // point it at your Bloc server
});

// Everything from the official Notion SDK works unmodified.
const page = await notion.pages.create({ /* … */ });
```

The `tests/sdk-progressive/` suite enforces this compatibility — every endpoint the official SDK calls is exercised against the Bloc server.

## Documentation

User- and developer-facing docs live under [`docs/`](./docs/); the original build specification suite (north-star plan, per-phase deliverables, pixel-perfect checklists) is under [`specs/`](./specs/).

- [`docs/`](./docs/README.md) — start here
- [`docs/platform/`](./docs/platform/README.md) — overview, architecture, data model, auth, realtime, Notion compatibility
- [`docs/self-hosting/`](./docs/self-hosting/README.md) — install, configure, run the servers, scale, back up, upgrade
- [`docs/api/`](./docs/api/README.md) — full REST reference: every endpoint, every schema, every operator
- [`docs/sdk/`](./docs/sdk/README.md) — `@bloc/sdk` reference: every namespace, function, parameter, type
- [`docs/reporting/`](./docs/reporting/README.md) — logs, metrics, traces, analytics, audit, dashboards, alerts
- [`docs/web/`](./docs/web/README.md) — web dashboard guide: editor, databases, sharing, search, AI, settings
- [`docs/apps/`](./docs/apps/README.md) — surface-specific guides: automations, forms, charts, sites, calendar, mail, wikis, AI agent, connections, imports/exports
- [`docs/guides/`](./docs/guides/README.md) — task-oriented walkthroughs: quickstart, first API call, integrations, migration, production deployment, custom blocks, webhook receivers, `react-notion-x`, bulk imports, pitfalls
- [`specs/`](./specs/) — the original build specification suite

## Repository layout

```
apps/
  api/          REST + WebSocket server
  web/          Next.js 15 frontend
  worker/       Background jobs
packages/
  db/           Postgres schema + migrations
  shared/       Types, validators, block & property schemas
  sdk/          First-party TypeScript SDK
  ui/           Design-system components
  ai/           Provider-agnostic LLM interface
  observability/ OpenTelemetry wiring
tools/
  benchmark/    p50/p99 harness
  otel/         Collector config
tests/
  contract/     API contract tests
  sdk-progressive/ SDK conformance tests
  e2e/          Playwright
  visual/       Visual regression
  chaos/        Malformed / adversarial inputs
  observability/
docs/           Specification suite
```

## Development

```bash
pnpm lint              # biome check
pnpm typecheck         # turbo run typecheck across all packages
pnpm test              # unit + integration
pnpm test:sdk          # SDK conformance against the running API
pnpm test:e2e          # Playwright
pnpm test:visual       # visual regression vs reference screenshots
pnpm test:chaos        # malformed / adversarial inputs
pnpm bench -- --smoke  # p50/p99 benchmark smoke run
```

## License

Apache License 2.0 — see [LICENSE](./LICENSE).
