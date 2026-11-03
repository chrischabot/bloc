# Bloc

Bloc is a block-based workspace written in TypeScript that you run from source, with a REST API modelled on the public Notion API. Trying a Notion integration normally means pointing it at a real workspace behind a hosted, rate-limited API, and the block model underneath can only be studied from the outside. Bloc gives developers a local server for those experiments and a codebase they can read and change: pages are trees of blocks, databases are sets of typed properties with filters, formulas and rollups, and a Next.js editor works on both through the same API.

It began as an experiment in having an autonomous coding agent build a faithful replica of Notion from a detailed specification, and it is an advanced prototype rather than a Notion replacement. The data model, API and editor came a long way, but real sign-in, restart-safe storage and live AI providers are unfinished, so run it on your own machine with data you can lose.

## How it works

The API in `apps/api` is a Hono server. It validates each request against the Zod schemas in `packages/shared`, which define 38 block types and 23 property types, and stores the result through the Drizzle repositories in `packages/db`. Each block is a row holding its parent, its type, a JSONB payload and a fractional index, which lets a new block go between two siblings without renumbering them. Database queries run through a query engine that applies filters and sorts and computes formula and rollup values, using a formula tokenizer, parser and evaluator that Bloc implements itself. The web app in `apps/web` reaches the API through Next.js rewrites and calls it with the first-party SDK in `packages/sdk`, so most of what the editor does goes through the same `/v1` routes an integration would use.

## Getting started

You need Node.js 22 and pnpm 10. Start with the API; it uses an in-memory PGlite database by default, so Docker is not needed.

```bash
git clone https://github.com/chrischabot/bloc.git
cd bloc
pnpm install
BOOTSTRAP_DEV=1 RATE_LIMIT_DISABLE=1 pnpm --filter @bloc/api dev
```

The API listens on http://localhost:3001. Check it with `curl http://localhost:3001/health`, then use the bootstrap and page-creation calls below. `BOOTSTRAP_DEV=1` enables the development workspace, and `RATE_LIMIT_DISABLE=1` avoids the anonymous quota applied before authentication. Pass these values in the shell: the API does not load the repository's root `.env` file. Restarting the default in-memory server starts an empty database.

The Next.js editor is still development work. At this revision, `apps/web/app/page.tsx` and `apps/web/app/(workspace)/page.tsx` both define `/`, a conflicting route that needs resolving before the root browser entry point can be relied on. The API quick start does not depend on the web app.

## Calling the API

With the API running, use `curl` and `jq` to create the development workspace and retrieve its token:

```bash
export BLOC_TOKEN=$(curl -s -X POST http://localhost:3001/v1/bootstrap | jq -r '.session_bearer | sub("^Bearer "; "")')

curl -s http://localhost:3001/v1/pages \
  -H "Authorization: Bearer $BLOC_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"parent":{"type":"workspace","workspace":true},"title":"Hello, Bloc"}'
```

To try the official client, pass that token and point it at your server with `new Client({ auth: process.env.BLOC_TOKEN, baseUrl: 'http://localhost:3001' })`. The routes, objects, pagination and `Notion-Version` header are modelled closely enough for that to be worth trying, but treat it as an experiment. Bloc's validators require the explicit `type` field on parents, blocks and rich text that Notion lets callers omit, so `parent: { page_id }` has to become `parent: { type: 'page_id', page_id }`. The server accepts `Notion-Version` values `2022-06-28`, `2025-09-03`, `2026-03-11` and `2026-04-01`, rejects others with a 400, and does not vary its responses by version. Bloc's own test suites drive its first-party SDK rather than `@notionhq/client`, so test the calls your integration depends on.

That SDK, `@bloc/sdk`, is an unpublished workspace package whose entry point is TypeScript source and whose dependency on `@bloc/shared` uses `workspace:*`. The examples assume this monorepo; using it elsewhere requires packaging both packages. Alongside `/v1`, the API serves `/api/v3/*`, which returns a `recordMap` shaped for `react-notion-x`, though nothing in the repository runs that renderer. The [API](./docs/api/README.md) and [SDK](./docs/sdk/README.md) references cover the rest, including the `/v1` resources Notion does not have, such as charts, forms, automations and reminders.

## Before you rely on it

Two gaps decide what Bloc is safe to use for. Sign-in is not finished: the Google callback refuses a live token exchange, magic links are never emailed, and the web app runs on a development session, while the API accepts `test_<workspace>_<user>` bearer tokens without verifying them in every environment, so anyone who can reach the port can act as any user. The default in-memory database is lost on restart. Postgres and file-backed PGlite can retain data, but the API replays every migration on startup without tracking which have run, so it fails when reopening an already migrated database. `docker compose up -d postgres` provides a disposable Postgres instance at `postgres://bloc:bloc@localhost:5432/bloc_dev` for fresh-database experiments through `DATABASE_URL`. Keep Bloc off networks you don't trust and treat every database as disposable.

The rest of the product is shallower than its routes and documentation suggest. The AI routes answer from a deterministic stub whatever `AI_PROVIDER` says. Search is substring matching in the database, and page events reach API clients only through polling and long-polling, so open tabs do not update each other live. There is no file upload or outbound email, and automations, forms, charts and webhooks have API routes but no UI.

`docker-compose.yml` also starts Redis, MeiliSearch, MinIO and Mailpit for a planned architecture the code does not use yet, and parts of `docs/` and `specs/`, the self-hosting guide especially, describe that intended product rather than this code. Where they disagree with the source, trust the source.

## Documentation

- [Documentation index](./docs/README.md)
- [Platform](./docs/platform/README.md): architecture, data model, realtime, Notion compatibility
- [REST API](./docs/api/README.md) and [SDK](./docs/sdk/README.md) references
- [Web app](./docs/web/README.md): editor, databases, sharing, search
- [Guides](./docs/guides/README.md): first API call, integrations, webhook receivers, bulk imports
- [Specification suite](./specs/README.md) and [phase plan](./specs/PLAN.md): what the project set out to build and what was deferred

## Development

```bash
pnpm typecheck   # TypeScript across the workspace
pnpm lint        # Biome
pnpm test        # Vitest suites on in-memory PGlite, no services needed
pnpm test:e2e    # Playwright, against a running web app and API
```

`package.json` has the rest, including `test:sdk`, `test:chaos`, `test:obs` and the `bench:*` scenarios. Playwright needs a browser first: `pnpm --filter @bloc/tests-e2e exec playwright install chromium`.

## Project background

- [Bloc project overview](https://chabot.dev/projects/#bloc) on Chris Chabot’s site.

## License and credits

Apache License 2.0; see [LICENSE](./LICENSE).

Bloc was built by an autonomous coding agent, Maestro, working phase by phase through the specification suite in `specs/`, with Chris Chabot directing the work. The suite draws on Notion's public API reference, help centre and engineering blog, the official `@notionhq/client` SDK and community projects such as `notion-py` and `react-notion-x`, all listed in [specs/CANONICAL-REFERENCES.md](./specs/CANONICAL-REFERENCES.md). Notion is a trademark of Notion Labs, Inc.; Bloc is an independent project and is not affiliated with or endorsed by it.
