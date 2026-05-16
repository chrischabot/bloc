# Bloc — Specification Suite

This repository contains the complete specification set required to build a byte-perfect, pixel-perfect replica of [notion.so](https://www.notion.so). It is written for an autonomous coding agent (Maestro) operating with high autonomy and quality.

The agent **must** treat every document under `docs/` as authoritative. When a conflict exists between the agent's prior knowledge and a document here, the document wins. When a conflict exists between a document here and Notion's live documentation at `developers.notion.com/reference`, the live documentation wins — the agent must update the docs in the same change-set.

---

## How to read this suite

Read in this order:

1. **`PLAN.md`** — The master plan. Contains the phase list and the checkbox todo for every deliverable. This is the live status board; check items off as they are completed.
2. **`prompts/AGENT-INSTRUCTIONS.md`** — Operating rules for the agent, including the Definition of Done gates that every phase must pass.
3. **`architecture/`** — System architecture, tech stack, data model, storage, realtime, auth, observability, security.
4. **`api/`** — Complete REST contract: conventions, errors, rate limits, every endpoint, every schema, every filter operator.
5. **`frontend/`** — Complete UI specification: design system, app shell, sidebar, editor, every block component, every database view, every property editor, pixel-perfect checklist.
6. **`phases/PHASE-XX-*.md`** — One file per phase. Contains scope, deliverables, todos, acceptance criteria, test plan, and the agent prompt template for that phase.
7. **`testing/`** — Testing strategy: Biome, unit, integration, contract, SDK-progressive, Playwright, visual regression, benchmarks (p50/p99), chaos, observability assertions.
8. **`observability/`** — Tracing, logging, metrics, dashboards.

---

## Repository layout the agent will produce

The agent will materialise the product under the following monorepo structure:

```
.
├── apps/
│   ├── api/                 # REST + WebSocket server (Notion API surface)
│   ├── web/                 # Next.js 15 frontend (notion.so UI)
│   └── worker/              # Background jobs (search indexing, exports)
├── packages/
│   ├── db/                  # Postgres schema + migrations + Prisma/Drizzle client
│   ├── shared/              # Shared types, validators, block/property schemas
│   ├── editor/              # Block editor (rich-text + block tree)
│   ├── ui/                  # Design-system components
│   ├── sdk/                 # First-party TypeScript SDK (mirrors @notionhq/client)
│   └── observability/       # OpenTelemetry wiring
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── contract/            # API contract tests vs the spec
│   ├── sdk-progressive/     # Progressively widening SDK conformance tests
│   ├── e2e/                 # Playwright
│   ├── visual/              # Visual regression vs reference screenshots
│   ├── benchmark/           # p50/p99 harness
│   └── chaos/               # Malformed/oversized/adversarial inputs
├── benchmarks/
│   └── reports/             # Generated p50/p99 reports per API
├── reference/
│   └── screenshots/         # Curated reference shots from notion.so + docs
└── docs/                    # THIS suite
```

---

## Universal Definition of Done (applies to every phase)

A todo is not "done" until **all** of the following are true:

1. **Biome lint + format pass** on the entire workspace: `pnpm biome check .` exits 0.
2. **Type-check passes**: `pnpm typecheck` exits 0 across all packages.
3. **Unit tests pass** for the touched packages with ≥90% line coverage on new code.
4. **Integration tests pass** for the API endpoints touched (real Postgres, real HTTP).
5. **Contract tests pass** verifying the API matches the schemas in `docs/api/schemas/`.
6. **SDK-progressive tests pass** for every SDK function whose underlying endpoint is now implemented.
7. **Playwright E2E tests pass** for every user journey covering the new UI surface.
8. **Benchmarks executed**: a fresh p50/p99 report is committed under `benchmarks/reports/` for every new endpoint, and p99 stays under the budget defined in `docs/testing/08-benchmarks.md`.
9. **Chaos tests pass**: malformed, oversized, adversarial inputs and crash attempts all return clean error responses with no 5xx leaks.
10. **Observability assertions pass**: every successful request produces a trace; every 4xx/5xx error is logged with structured context; every UI interaction emits the expected client event. See `docs/testing/10-observability-tests.md`.
11. **PLAN.md todos** for the phase are checked off, with a short evidence line per todo.
12. **No throwaway debug code, no commented-out blocks, no orphaned files.**

Skipping any of these is grounds for the phase being reopened.

---

## Project north star

> When a user opens our product in a browser, navigates the sidebar, creates a page with every block type, builds a database with every property type, filters / sorts / changes view, invites a teammate, comments, mentions, exports, runs an automation or button, fills a form, views a chart, opens an AI agent, publishes a page, syncs an external source, and verifies a wiki page — every pixel, every keystroke response, every API payload, and every trace **must be indistinguishable** from production notion.so to a careful observer.

The scope therefore spans 27 phases (`Phase 0` through `Phase 26`). Phases 0–13 ship core editing, databases, realtime, sharing, comments, and the first pixel-perfect bar. Phases 14–22 ship the extended product surface (Automations, Forms, Charts, Sub-items / Dependencies, Wikis, Home, Backlinks, Reminders, Notion AI, Sites, Sync, Mail, Connections, Webhooks, Version History, Analytics, Audit). Phase 23 re-runs pixel-perfect validation over the extended surface. Phases 24–25 add the internal v3 API (`docs/architecture/09-internal-v3-api.md`) and the data-sources primitive (`docs/architecture/10-data-sources.md`). Phase 26 is the final acceptance gate including v3 conformance via `<NotionRenderer/>` from `react-notion-x`.

## Honest scoping

The "byte-perfect" and "pixel-perfect" targets are not uniform across the surface. Read this calibration before writing code:

| Surface | Target | Conformance test |
|---------|--------|------------------|
| **Public REST API** (`api.notion.com/v1`) | **Byte-equivalent** | Official `@notionhq/client` works unmodified against our server; SDK-progressive tests in `tests/sdk-progressive/` enforce this. |
| **Public webhooks** | **Byte-equivalent** within the documented event surface | The catalogue in `docs/api/endpoints/webhooks.md#subscribed-event-catalogue` is exhaustive; user-change and workspace-settings events are deliberately **not** delivered. Achieving parity here means parity with a feature-light surface, not with Notion's internals. |
| **Internal v3 API** (`www.notion.so/api/v3`) | **Behavioural-equivalent** | `<NotionRenderer/>` from `react-notion-x` renders our `recordMap` indistinguishably from a real notion.so page. See `docs/architecture/09-internal-v3-api.md`. We do **not** promise byte parity because the v3 surface mutates with every Notion release. |
| **Sync protocol** (WebSocket + offline replay) | **Behavioural-equivalent** | Two-tab convergence test, offline-replay test, 50-concurrent-editor load test. The wire format is internal; we document ours but make no claim of byte parity with Notion's. |
| **UI** | **Pixel-equivalent** within the screenshot corpus | `tests/visual/` against `reference/screenshots/`. Surfaces with no captured reference are flagged inferential. |
| **AI feature surfaces** | **Shape-equivalent** | Same surfaces (Writer / Q&A / Agent / Autofill / Meeting Notes), same citation format, same Custom-Agent trigger model. **Answer quality** depends on the chosen LLM provider and is *not* a parity target — Notion's retrieval and prompt engineering are not public. |

Treat anything outside these targets as a non-goal unless a doc explicitly upgrades it.