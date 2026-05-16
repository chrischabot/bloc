# Changelog

## Phase 4.9/4.10/4.11 & Phase 15 — Formulas, Rollups, Relations, Charts — 2026-05-16

**Status:** complete (backend); UI configurators deferred

**Major artefacts:**
- `packages/shared/src/formulas/` — tokenizer + Pratt parser + evaluator with 25+ built-in functions (prop, if, concat/length/upper/lower/replace/slice, abs/round/floor/ceil/min/max/pow/sqrt/log, not/empty, toNumber, contains/startsWith/endsWith). Short-circuit `&&`/`||`, type-aware arithmetic, division/modulo-by-zero throws `FormulaEvalError`.
- `packages/db/src/rollup.ts` — `evaluateRollup` walks relation refs, reads target property values in one query via `inArray`, aggregates with 21 functions (count, count_values, unique, percent_empty/not_empty, sum/average/median/min/max/range, earliest/latest_date, date_range, show_original/show_unique, checked/unchecked, percent_checked/unchecked).
- `packages/db/src/query-engine.ts` — `evalFilter` now async; evaluates formula and rollup filter branches live. Formula sort also supported.
- `packages/db/src/repositories/relations.ts` — `syncDualRelation` propagates dual_property adds/removes to the inverse property idempotently. `extractRelationRefs` helper.
- `apps/api/src/routes/pages.ts` — `writePageProperty` helper captures old relation refs before writing the new value, then triggers the inverse sync. Applied on both POST + PATCH.
- `apps/api/src/page-serializer.ts` — `stampRichText` stamps `plain_text` from `text.content` on title/rich_text property values.
- `packages/shared/src/charts/index.ts` — `ChartConfigSchema` with 7 kinds (bar/line/area/scatter/pie/donut/number), 10 aggregations, group_by, optional filter, style with palette/title/description/legend/grid/data_labels/stacked.
- `packages/db/src/charts.ts` — `evaluateChart` with grouped series generation, numeric-ascending or insertion-order bucket sorting, filter routed through existing `queryDatabase` for semantic parity, default 8-color palette.
- `apps/api/src/routes/charts.ts` — `POST /v1/charts/evaluate` with `can_read` ACL on the database + `charts.evaluate.<kind>` span.
- `packages/sdk/src/charts.ts` — `ChartsNamespace.evaluate(config)`.

**Tests:**
- `packages/shared/src/formulas/formulas.test.ts` — 20 formula unit tests (tokeniser/parser/evaluator).
- `packages/db/src/rollup.test.ts` — 17 rollup unit tests covering count, sum, average, median, min/max/range, percent_*, date aggregates, checkbox aggregates, show_original, unsupported envelope.
- `apps/api/src/routes/databases-formula.test.ts` — 5 integration tests for formula filter/sort + division-by-zero graceful degradation.
- `apps/api/src/routes/relations-sync.test.ts` — 6 dual_property tests: single add, multi-add, removal, clearing, single_property non-sync, POST-create-time sync.
- `apps/api/src/routes/charts.test.ts` — 9 chart tests covering number/bar/pie kinds, group_by, filter application, empty database, 404, unknown kind.

**Deferred to v1.1:** Chart cache layer, chart configurator UI, rollup `any`/`every`/`none` filters, chart point-in-time data lake.

**Spec updates:** none (built directly from `docs/api/schemas/formulas.md`, `docs/api/schemas/property-types.md`, `docs/frontend/22-charts.md`).

**Test summary:** 15/15 test tasks pass — 35 API / 12 SDK-progressive / 7 chaos / 9 shared / 4 db / 2 contract / 2 worker / 1 sdk / 1 ai / 1 observability / 1 integration.

---

## 2026-05-16 — Final session — Reactions, Quick Switcher, Permissions, Web Vitals, Email Digest

**Status:** complete (backend + frontend wiring + tests + benchmarks)

### Comment reactions + resolve (Phase 11.3)

- `comment_reactions` table (migration 010) with `(comment_id, user_id, emoji)` unique index; cascading FKs to comments + users.
- `packages/db/src/repositories/comments.ts` — addReaction (idempotent on unique key), removeReaction, listReactionsForComment, listReactionsForComments (batch), getComment.
- `apps/api/src/routes/comments.ts` — `POST /v1/comments/:id/reactions`, `DELETE /v1/comments/:id/reactions/:emoji`, `POST /v1/comments/:id/resolve`. List endpoint batches reactions via `listReactionsForComments` to eliminate N+1.
- `packages/sdk/src/comments.ts` — `client.comments.addReaction`, `removeReaction`, `resolve`.
- Tests: `apps/api/src/routes/comments.test.ts` (10 tests) + `tests/sdk-progressive/comments-reactions.test.ts` (3 tests including explicit idempotency assertion).

### Quick Switcher (Cmd-K)

- `apps/web/components/QuickSwitcher.tsx` — global Cmd/Ctrl-K hotkey, debounced input, SDK-backed `/v1/search`, keyboard navigation, mounted under the workspace layout.

### Page Permissions UI + SDK (Phase 6.6 frontend wiring)

- `packages/sdk/src/permissions.ts` — `PermissionsNamespace` (`client.permissions.list/grant/revoke/me`).
- `apps/web/components/PermissionsPanel.tsx` — drives the SDK helpers with grantee-type / level pickers.
- Tests: `tests/sdk-progressive/permissions.test.ts` (2 round-trip tests).

### Web Vitals Beacon

- `apps/web/components/WebVitalsBeacon.tsx` — PerformanceObserver registers for LCP, FCP, INP, CLS, TTFB; posts each via `client.analytics.beacon`; mounted invisibly under the workspace shell.

### Email digest worker (Phase 11.6 stub)

- `apps/worker/src/email-digest.ts` — polls `/v1/reminders/scan-due`, groups due reminders per user, emits structured "would-send" logs. SMTP / provider integration deferred to v1.1.
- Boots from `apps/worker/src/index.ts` alongside the heartbeat loop.
- Tests: `apps/worker/src/email-digest.test.ts` (2 tests).

### FilterSortPanel + database wiring

- `apps/web/app/(workspace)/database/page.tsx` — `FilterSortPanel` rendered above `DatabaseViewTabs` and reports staged-filter summary; preserved 4 demo rows + `groupBy="Status"`.

### Phase 22 benchmark

- `tools/benchmark/scenarios/phase-22-reminders-versions.ts` — covers reminders.list, reminders.create, versions.list. `pnpm bench:phase-22` script and added to `pnpm bench:sweep`.
- `benchmarks/reports/phase-22-2026-05-16.json` — all 3 scenarios pass at p99 ≤ 17ms (budget 150ms).

### Sidebar

- Reminders quick-action button (opens `RemindersPanel`); `/analytics` footer link.

### Extended block-type rendering

- `apps/web/components/BlockRenderer.tsx` now covers 26 of 38 block types: paragraph, h1/2/3, bullet, numbered, to_do, toggle, quote, divider, breadcrumb, table_of_contents, callout, code, equation, image, video, audio, file, pdf, bookmark, embed, link_preview, link_to_page, child_page, child_database, column_list, column, table, table_row, synced_block.

---

## 2026-05-16 — Late session — Reminders, Analytics, Version History, Extended Block Coverage

**Status:** complete (backend + SDK + UI scaffolding)

### Reminders (Phase 17.6)

- `packages/db/src/schema/reminders.ts` + migration 009 — `reminders` table with `due_at`, fired-state, indexed for per-user listing and due-row scans.
- `packages/db/src/repositories/reminders.ts` — full CRUD plus `findDueReminders` (worker scan helper).
- `apps/api/src/routes/reminders.ts` — REST surface: create/list/retrieve/fire/delete plus admin-gated `POST /v1/reminders/scan-due` for the deferred worker.
- `packages/sdk/src/reminders.ts` — `RemindersNamespace`.

**Tests:** `apps/api/src/routes/reminders.test.ts` (9 tests covering create, list, retrieve, fire, delete, scan-due admin gate, include_fired filter, validation rejections).

### Analytics (Phase 22 — Web Vitals beacon)

- `packages/db/src/schema/analytics.ts` + migration 008 — `analytics_events` table indexed on `(workspace_id, created_at desc)` for time-window reads.
- `packages/db/src/repositories/analytics.ts` — `recordAnalyticsEvent` + `listAnalyticsEvents` with kind filter.
- `apps/api/src/routes/analytics.ts` — `POST /v1/analytics/beacon` (page-view / web-vital / ui-action with kind-specific validation), admin-gated `GET /v1/analytics/events` (raw listing) and `GET /v1/analytics/summary` (aggregated per-metric p50/p95 + counts).
- `packages/sdk/src/analytics.ts` — `AnalyticsNamespace`.

**Tests:** `apps/api/src/routes/analytics.test.ts` (10 tests including kind-specific validation, admin gate, summary aggregation).

### Page Version History (Phase 22.1 stub)

- `apps/api/src/routes/versions.ts` — `GET /v1/pages/:id/versions` (newest-first, cursor pagination) + `GET /v1/pages/:id/versions/:clock` (snapshot envelope with recordMap and cumulative update count).
- `packages/sdk/src/versions.ts` — `VersionsNamespace`.

**Tests:** `apps/api/src/routes/versions.test.ts` (7 tests including pagination, snapshot retrieval, 404 on unknown clock/page).

**Note:** snapshot reflects current relational state plus the requested clock metadata. Yjs-driven point-in-time replay lands in v1.1 with the realtime gateway.

### Extended block-type rendering

- `apps/web/components/BlockRenderer.tsx` extended from 14 → 26 block types: toggle, table, table_row, column_list, column, synced_block, link_to_page, child_page, child_database, video, file, pdf, audio, embed, link_preview, breadcrumb, table_of_contents. Existing 14 types preserved.

### Theme toggle (Phase 7.6)

- `apps/web/components/ThemeToggle.tsx` — persisted light/dark switch with localStorage + `prefers-color-scheme` fallback, mounted into the TopBar without regressing the Sharing dialog wiring.

### FilterSortPanel UI (Phase 9.9)

- `apps/web/components/FilterSortPanel.tsx` — read-only filter/sort builder mapping property types to operator vocabularies; resets operator when filter property changes to keep emitted state valid.

### SDK additions

- `packages/sdk/src/index.ts` — `client.reminders.*`, `client.analytics.*`, `client.versions.*` wired into the `Notion` facade.
- `tests/sdk-progressive/reminders-analytics-versions.test.ts` — end-to-end SDK tests for all three namespaces (3 tests).

### Public sites

- `tests/contract/sites.test.ts` — public renderer contract test (6 assertions: live publication retrieval, no-auth access, unknown slug 404, expired publication, draft publication, canonical error envelope).

### v3 chaos hardening

- `tests/chaos/v3.test.ts` — every 4xx assertion now verifies the canonical error envelope (object/code/status/message/request_id), not just status code (13 tests).

---

## v3 queryCollection + Automatic Backlinks Reindex + Worker Firing — 2026-05-16

**Status:** complete

**Major artefacts:**
- `apps/api/src/routes/internal-v3.ts` — `POST /api/v3/queryCollection` and `/queryCollectionV2` endpoints back v3 clients with the in-process database query engine; workspace mismatch returns 404 to hide existence. Optional `loader.searchQuery` substring filter is applied against `page_properties` values for database rows.
- `apps/api/src/routes/internal-v3-query.test.ts` — 6 integration tests including cross-workspace 404 enforcement.
- `packages/sdk/src/v3.ts` — `client.v3.queryCollection` / `queryCollectionV2` namespace methods.
- `apps/api/src/backlinks/reindex.ts` — `reindexBacklinksAsync(handle, pageId)` is fire-and-forget but deduplicates by pageId so high-frequency mutations don't queue redundant work; `drainBacklinksReindex()` exposes deterministic teardown.
- `apps/api/src/routes/blocks.ts` — every append/update/delete now auto-triggers backlinks reindex against the resolved page-ancestor (nested blocks correctly walk up).
- `apps/api/src/routes/backlinks-auto.test.ts` — 3 tests verifying append/update/delete keep backlinks in sync without explicit `:reindex` calls.
- `apps/api/src/test-helpers.ts` — `closeHarness(harness)` drains emit + backlinks before closing PGlite, fixing WASM races in test/bench teardown. All 31 existing test files updated to use it.
- `apps/worker/src/email-digest.ts` — upgraded from logging-only to actually firing due reminders via `POST /v1/reminders/:id/fire`; per-user grouping preserved; `tick()` returns `{ scanned, fired, failed, users }` for observability.
- `apps/worker/src/email-digest.test.ts` — 5 tests including bearer short-circuit, multi-user dispatch, and partial-failure accounting.

**Benchmark sweep (8/8 passed):**
| Scenario | p50 | p99 | Budget |
|---|---|---|---|
| `db.listChildren-100` | 5.3 ms | 10.0 ms | 80 ms |
| `blocks.children.append-100` (with auto-reindex) | 144 ms | 231 ms | 250 ms |
| `pages.create-no-children` | 7.6 ms | 17.4 ms | 150 ms |
| `databases.query-100rows-2clause` | 56.0 ms | 109.9 ms | 250 ms |
| `search.empty-query-50pages` | 57.6 ms | 102.5 ms | 200 ms |
| `reminders.list-50` | 3.5 ms | 15.5 ms | 150 ms |
| `reminders.create` | 3.3 ms | 8.5 ms | 150 ms |
| `versions.list-25` | 5.0 ms | 15.5 ms | 150 ms |

**Test summary:** 15/15 tasks, 27 API test files (with v3-query + backlinks-auto + lifecycle-webhooks added), 10 SDK-progressive, 7 chaos, 8 shared, 3 db, 2 contract, 2 worker. ~300 tests total.

---

## Inbox Notifications + Property-aware Backlinks — 2026-05-16

**Status:** complete

**Major artefacts:**
- `apps/api/src/routes/inbox.ts` + `inbox.test.ts` — `GET /v1/inbox` aggregates three notification kinds: `comment` (comments on actor-owned pages), `mention` (user mentions in comments or block rich_text), `page_update` (edits by other users on actor-owned pages). Filters by `kind`, `since`, `page_size`.
- `packages/sdk/src/inbox.ts` — `InboxNamespace` exposing `client.inbox.list({ kind, since, page_size })`.
- `tests/sdk-progressive/inbox.test.ts` — cross-package coverage for the namespace.
- `apps/web/components/InboxPanel.tsx` — replaced sample data with real SDK calls; All / Mentions / Following tabs map to inbox kinds; relative-time formatting; loading + error + empty states.
- `packages/db/src/repositories/backlinks.ts` — the indexer now also walks `page_properties` for database-row pages: relation values produce `relation` backlinks; rich_text mentions inside property values produce `mention` backlinks.
- `apps/api/src/routes/backlinks-properties.test.ts` — 2 tests covering both kinds.
- `apps/api/src/routes/pages.ts` — automatic `reindexBacklinksAsync` invocations on page create (with seeded properties/children), page update (when properties change), and unarchive transitions. The helper coalesces by pageId so repeated triggers don't queue redundant work.

**Test summary:** 15/15 tasks, 29 API test files, 11 SDK-progressive, 7 chaos, 8 shared, 3 db, 2 contract, 2 worker. ~315 tests total.

**Benchmark sweep (8/8 passed):** `db.listChildren-100` p99 13.4ms, `blocks.children.append-100` p99 230ms (with auto-reindex + webhook fanout), `pages.create-no-children` p99 19ms, all under budget.

---

## Webhook Fanout & Drainable Emitter — 2026-05-16

**Status:** complete

**Major artefacts:**
- `apps/api/src/webhooks/emit.ts` — `Emitter` becomes a callable with `drain()`; tracks the in-flight Promise set, swallows delivery errors with structured `pino` logging (`debug` on success, `warn` on swallowed failure).
- `apps/api/src/server.ts` — `AppDeps.emit?: Emitter` lets callers (tests, benchmarks) inject a shared emitter so `emit.drain()` actually drains the same set the routes use.
- `apps/api/src/test-helpers.ts` — `bootTestHarness()` builds the emitter once, passes it into `createApp`, returns it as `harness.emit` for deterministic drain.
- Lifecycle webhook fanout wired into every mutation router (comments, databases, automations/buttons, forms, publications, wikis) using a shared single emitter.
- `apps/api/src/routes/lifecycle-webhooks.test.ts` — 8 integration tests covering `comment.created`/`comment.resolved`/`database.created`/`database.updated`/`automation.run.completed`/`form.submission.created`/`publication.created`/`publication.deleted`/`wiki.verification.changed`.
- `tools/benchmark/scenarios/phase-2-blocks.ts` and `phase-3-pages.ts` await `h.emit.drain()` before PGlite teardown, eliminating the WASM "memory access out of bounds" race seen when background dispatches outlived the DB handle.

**Benchmark sweep (8/8 passed):**
| Scenario | p50 | p99 | Budget |
|---|---|---|---|
| `db.listChildren-100` | 5.2 ms | 15.7 ms | 80 ms |
| `blocks.children.append-100` | 59.3 ms | 92.5 ms | 250 ms |
| `pages.create-no-children` | 8.4 ms | 22.8 ms | 150 ms |
| `databases.query-100rows-2clause` | 55.9 ms | 106.9 ms | 250 ms |
| `search.empty-query-50pages` | 56.8 ms | 166.1 ms | 200 ms |
| `reminders.list-50` | 4.6 ms | 9.3 ms | 150 ms |
| `reminders.create` | 3.0 ms | 10.8 ms | 150 ms |
| `versions.list-25` | 4.9 ms | 10.2 ms | 150 ms |

**Test summary:** 15/15 tasks, 25 API test files (177 → 185 tests with the new lifecycle suite), 10 SDK-progressive, 7 chaos, 8 shared, 3 db, 2 contract, 2 worker, ai/sdk/observability/integration.

---

## Phase 12 — Benchmark Sweep — 2026-05-16

**Status:** complete (backend scenarios)

**Major artefacts:**
- `tools/benchmark/sweep.mjs` — cumulative runner for the phase 1-5 scenarios.
- `pnpm bench:sweep` script.
- `benchmarks/reports/full-suite-2026-05-16.json` — 5/5 scenarios passed.

**Headline numbers:**
| Phase | Scenario | p50 | p99 | Budget |
|-------|----------|-----|-----|--------|
| 1 | `db.listChildren-100` | 5.2 ms | 11.8 ms | 80 ms |
| 2 | `blocks.children.append-100` | 58.4 ms | 104.0 ms | 250 ms |
| 3 | `pages.create-no-children` | 6.5 ms | 16.8 ms | 150 ms |
| 4 | `databases.query-100rows-2clause` | 57.3 ms | 96.7 ms | 250 ms |
| 5 | `search.empty-query-50pages` | 58.2 ms | 100.9 ms | 200 ms |

All five comfortably under budget. Frontend INP + Lighthouse deferred to Phase 13/20 (requires interactive editor).

---

## Phase 7+ Frontend Final Slice — 2026-05-16

**Status:** core shell + visual UI surfaces shipped; interactive editing deferred to v1.1

**Major artefacts (added this session):**
- `apps/web/components/CalendarView.tsx` — month grid with events on date property.
- `apps/web/components/TimelineView.tsx` — Gantt-style horizontal bars.
- `apps/web/components/InboxPanel.tsx` — Updates panel with All/Mentions/Following tabs.
- `apps/web/components/CommentsThread.tsx` — inline thread with composer.
- `apps/web/components/FormattingToolbar.tsx` — bold/italic/underline/strikethrough/code/link + 10-color picker + comment.
- `apps/web/components/DragHandle.tsx` — block-row drag/plus gutter.
- `apps/web/components/SlashMenu.tsx` — 27-item slash command palette with keyboard nav.
- `apps/web/components/DatabaseViewTabs.tsx` — Table / Board / Gallery / List / Calendar / Timeline tab switcher.
- `apps/web/app/(workspace)/settings/page.tsx` — Account / Workspace / Appearance / Integrations sections.
- `apps/web/app/(workspace)/editor/page.tsx` — playground showing 14 block types + drag handle + slash menu + formatting toolbar.
- Full design-token CSS at `apps/web/app/globals.css` (~1200 lines).

**Deferred to v1.1:**
- Contenteditable + Yjs binding (live keyboard editing).
- Shiki syntax highlighting for code blocks.
- KaTeX rendering for equations.
- Calendar / Timeline drag-to-create / drag-to-resize.
- Chart view, filter/sort/group-by UI panels.
- Email digest worker, real-time notification fanout to inbox.

---

## Phase 25 — Data Sources — 2026-05-16

**Status:** complete (backend)

**Major artefacts:**
- `apps/api/src/routes/data-sources.ts` — CRUD + query endpoints under `/v1`.
- `packages/db/src/schema/pages.ts` + migration 001 — `data_sources` table with `type ∈ {'owned','linked'}` and upstream FK columns.
- Default data source auto-created on database create.
- Linked-source cycle detection (linked-to-linked rejected with 409).
- Query on a linked data source routes to the upstream database id.

**Tests:** `apps/api/src/routes/data-sources.test.ts` covers happy path, default auto-create, linked source, cycle rejection, rename, archive, mismatched parameters.

**Spec updates:** none (built directly from `docs/architecture/10-data-sources.md`).

---

## Phase 24 — Internal v3 API — 2026-05-16

**Status:** behavioural-equivalent (full conformance harness deferred)

**Major artefacts:**
- `packages/shared/src/v3/inline.ts` — positional inline codec with marks `b/i/c/s/_/h/a/u/p/d/e/eoi/m`.
- `packages/shared/src/v3/index.ts` — `V3RecordMap` / `V3Transaction` / `V3Operation` types.
- `apps/api/src/v3/record-map.ts` — relational → recordMap builder.
- `apps/api/src/v3/operations.ts` — `set`/`update`/`listAfter`/`listBefore`/`listRemove` executor.
- `apps/api/src/routes/internal-v3.ts` — `/api/v3/loadPageChunk` / `getRecordValues` / `syncRecordValues` / `submitTransaction` / `loadUserContent`.

**Tests:** `apps/api/src/routes/internal-v3.test.ts` (8 tests covering read/write/auth/spaceId-mismatch); `packages/shared/src/v3/v3.test.ts` (codec round-trips).

**Honest scope:** behavioural-equivalent; `<NotionRenderer/>` conformance harness deferred to v1.1.

---

## Phase 22 — Audit Log — 2026-05-16

**Status:** complete

**Major artefacts:**
- `apps/api/src/routes/audit.ts` — `GET /v1/workspaces/:id/audit_events` (filter, cursor pagination) + `:export.csv`.
- Admin-only ACL via `getMemberRole`.

**Tests:** `apps/api/src/routes/audit.test.ts` (6 tests including pagination, filter-by-action, CSV export, admin-gate).

---

## Phase 21 — Webhooks — 2026-05-16

**Status:** complete

**Major artefacts:**
- `packages/db/src/schema/webhooks.ts` + migration 003.
- `apps/api/src/webhooks/signing.ts` — HMAC-SHA256 + constant-time verify.
- `apps/api/src/webhooks/dispatcher.ts` — synchronous fan-out with verification handshake and 5-failure auto-disable.
- Endpoints: CRUD + `/ping` + `/deliveries`.
- SDK `WebhooksNamespace`.

**Tests:** `apps/api/src/routes/webhooks.test.ts` (verification, signature verify, auto-disable, oversized subscribed_events, mismatched token rejection).

**Deferred to v1.1:** out-of-process delivery worker with backoff, replay endpoint.

---

## Phase 19 — Sites & Publications — 2026-05-16

**Status:** backend complete; public renderer + DNS provisioning deferred

**Major artefacts:**
- `packages/db/src/schema/sites.ts` + migration 006.
- `apps/api/src/routes/sites.ts` — publication CRUD on `/v1/pages/:id/publication`; custom-domain CRUD on `/v1/workspaces/:id/custom_domains`.
- Reserved-domain rejection, duplicate-domain 409, owner-only ACL.

**Tests:** `apps/api/src/routes/sites.test.ts` (publish/republish/unpublish, custom-domain CRUD, status patching).

**Deferred to v1.1:** public Next.js renderer route, sitemap.xml + robots.txt, TLS provisioning, sync workers.

---

## Phase 18 — Notion AI — 2026-05-16

**Status:** complete with deterministic stub LLM

**Major artefacts:**
- `packages/ai/src/index.ts` — `LLM` interface + `StubLLM` (deterministic) + `createLLM()` factory.
- `packages/db/src/schema/ai.ts` + migration 005 — `ai_runs` accounting.
- `apps/api/src/routes/ai.ts` — `/v1/ai/completions` + `/v1/ai/qa` + `/v1/ai/autofill/run` with ACL filtering.

**Tests:** `apps/api/src/routes/ai.test.ts` (writer, Q&A retrieval + ACL, autofill rich-text, autofill read-only rejection).

**Deferred to v1.1:** SSE streaming responses, real provider integrations (OpenAI/Anthropic), Meeting Notes transcription.

---

## Phase 17 — Backlinks — 2026-05-16

**Status:** complete

**Major artefacts:**
- `packages/db/src/schema/backlinks.ts` + migration 004 (unique PK via `COALESCE(source_block_id)` expression).
- `packages/db/src/repositories/backlinks.ts` — `reindexBacklinksForPage` extracts mentions + `link_to_page` refs.
- `apps/api/src/routes/backlinks.ts` — `GET /v1/pages/:id/backlinks` (ACL-filtered) + reindex.

**Tests:** `apps/api/src/routes/backlinks.test.ts` (mentions, link-to-page, orphan pages, 404).

---

## Phase 16 — Wikis — 2026-05-16

**Status:** complete (sub-items + dependencies deferred to v1.1)

**Major artefacts:**
- `pages.is_wiki` boolean + `pages.verification` jsonb (migration 007).
- `apps/api/src/routes/wikis.ts` — turn-into-wiki, verify (with `expires_in_days`), unverify, turn-off.

**Tests:** `apps/api/src/routes/wikis.test.ts` (lifecycle, never-expiry, non-wiki rejection).

---

## Phase 15 — Forms — 2026-05-16

**Status:** complete

**Major artefacts:**
- `packages/shared/src/forms/index.ts` — `FormConfigSchema` + `SubmissionBodySchema`.
- `apps/api/src/routes/forms.ts` — form view CRUD, public submission endpoint (outside auth middleware), workspace submissions list.
- close_at / max_submissions enforcement, required-title rule.

**Tests:** `apps/api/src/routes/forms.test.ts` (public submit, workspace-only rejection on anon, close_at 410, missing title 400).

---

## Phase 14 — Buttons & Automations — 2026-05-16

**Status:** complete

**Major artefacts:**
- `packages/shared/src/automations/index.ts` — `StepSchema`, `TriggerSchema`, `renderTemplate` with safe path resolution + prototype-key rejection.
- `apps/api/src/automations/executor.ts` — 10 step types (`add_page_to_database`, `edit_property`, `send_notification`, etc.).
- `apps/api/src/routes/buttons.ts` + `automations.ts` — button invoke, automation CRUD + dry-run, run log.

**Tests:** `apps/api/src/routes/automations.test.ts` (button invoke, automation lifecycle, template injection rejection); `packages/shared/src/automations/automations.test.ts` (codec).

**Deferred to v1.1:** Slack/email providers, SSE delivery, scheduled `time` triggers via BullMQ.

---

## Phase 10 — Realtime — 2026-05-16

**Status:** polling baseline shipped; WS gateway deferred

**Major artefacts:**
- `apps/api/src/realtime/bus.ts` — in-process pub/sub keyed by page id with seq cursor + capped buffer.
- `apps/api/src/routes/realtime.ts` — `GET /v1/realtime/pages/:id?since=…` + `POST /v1/realtime/pages/:id/wait` long-poll.
- `apps/api/src/routes/blocks.ts` publishes `block.appended` / `block.updated` / `block.deleted`.

**Tests:** `apps/api/src/realtime/bus.test.ts` (5 tests); `apps/api/src/routes/realtime.test.ts` (long-poll wake, empty timeout, validation).

**Deferred to v1.1:** WebSocket gateway, Yjs document binding, awareness messages, offline replay.

---

## Phase 9 — Database Views — 2026-05-16

**Status:** table/board/gallery/list shipped; calendar/timeline/chart deferred

**Major artefacts:**
- `apps/web/components/TableView.tsx` — native `<table>` rendering with title/status/select/multi_select/date/checkbox/url cells.
- `apps/web/components/BoardView.tsx` — Kanban-style columns grouped by select/status.
- `apps/web/components/GalleryView.tsx` — responsive card grid.
- `apps/web/components/ListView.tsx` — compact rows with property chips.
- `apps/web/components/DatabaseViewTabs.tsx` — tab bar that switches between views.

**Deferred to v1.1:** Calendar / Timeline / Chart views, filter & sort UI, group-by sub-group, optimistic edits.

---

## Phase 8 — Block Editor — 2026-05-16

**Status:** read-only renderer + slash-menu UI; interactive contenteditable deferred

**Major artefacts:**
- `apps/web/components/BlockRenderer.tsx` — covers paragraph, h1/2/3, bulleted/numbered, to_do, quote, divider, callout, code, equation, image, bookmark (12 of 38).
- `apps/web/components/SlashMenu.tsx` — 27-item slash command palette with arrow-key navigation + section grouping per `docs/frontend/09-slash-menu.md`.
- 19-color rich-text palette via CSS tokens.

**Deferred to v1.1:** contenteditable + Yjs binding, formatting toolbar, drag handle / plus button, image upload, Shiki syntax highlight, KaTeX rendering, all interactive editing semantics.

---

## Phase 7 — Frontend Shell — 2026-05-16

**Status:** complete

**Major artefacts:**
- `apps/web/app/(workspace)/layout.tsx` — shell composing TopBar + Sidebar + content.
- `apps/web/components/Sidebar.tsx` — workspace switcher, quick actions, Favourites / Teamspaces / Shared / Private sections, footer.
- `apps/web/components/TopBar.tsx` — breadcrumb + Share button wired to SharingDialog.
- `apps/web/components/SharingDialog.tsx` — Share / Publish tabs with invite combobox + role dropdowns.
- `apps/web/app/globals.css` — full design-token + component CSS per `docs/frontend/01-design-system.md`.

---

## Phase 6 — Auth, Workspaces, Permissions — 2026-05-15

**Status:** complete

**Major artefacts:**
- `apps/api/src/middleware/auth.ts` — dual-path bearer (test stub + bcrypt-hashed integration tokens with 60s verify cache).
- `apps/api/src/middleware/rate-limit.ts` — Redis-style token bucket with per-route overrides.
- `apps/api/src/routes/{integrations,workspace-members,permissions,auth}.ts` — full CRUD + admin-only gates.
- Email magic-link with in-memory pending store; OAuth + sessions deferred to v1.1.

**Tests:** `apps/api/src/routes/phase-6.test.ts` (12 tests); chaos rate-limit test in `tests/chaos/phase-6.test.ts`.

---

## Phase 5 — Search, Comments, Users — 2026-05-15

**Status:** complete

**Major artefacts:**
- `apps/api/src/routes/{search,comments,users}.ts`.
- `/v1/search` workspace search via ILIKE with per-row ACL filtering.
- Comments create + list, discussion replies.

**Benchmark:** p99 101.76ms on 50-page workspace (budget 200ms).

---

## Phase 4 — Databases API — 2026-05-15

**Status:** complete

**Major artefacts:**
- `packages/shared/src/filters/index.ts` — per-property-type operator union + compound and/or with depth ≤ 2.
- `packages/db/src/query-engine.ts` — in-process filter/sort/pagination.
- `apps/api/src/routes/databases.ts` — create/retrieve/update/query.

**Benchmark:** p99 90.76ms on 100-row + 2-clause filter (budget 250ms).

---

## Phase 3 — Pages API — 2026-05-15

**Status:** complete

**Major artefacts:**
- `apps/api/src/routes/pages.ts` — POST/GET/PATCH + properties/:id sub-route.
- Title-required-on-DB-parent enforcement.
- Initial children atomic insertion.

**Benchmark:** p99 13.98ms create (budget 150ms).

---

## Phase 2 — Blocks API — 2026-05-15

**Status:** complete

**Major artefacts:**
- `packages/shared/src/blocks/index.ts` — 38 block-type Zod catalogue + `AnyBlockInputSchema`.
- `apps/api/src/routes/blocks.ts` — 5 endpoints with type-specific payload validation.
- `apps/api/src/serializer.ts` — `plain_text` stamping; `caption` round-trip.
- `packages/sdk/src/blocks.ts` — `BlocksNamespace` mirroring `@notionhq/client`.

**Benchmark:** p99 104.7ms append-100 (budget 250ms).

---

## Phase 1 — Data Model — 2026-05-15

**Status:** complete

**Major artefacts:**
- Drizzle schema covering 17 tables.
- 7 forward + reverse migrations.
- 15 repository modules.
- Fractional-indexing helper with 11 unit tests.
- Seed script materialising 1 user, 5 pages, 1 database with all 20 property types, 1 sample page per block type.

**Benchmark:** p99 16.8ms 1000-child list (budget 80ms).

---

## Phase 0 — Foundation & Tooling — 2026-05-15

**Status:** complete

**Major artefacts:**
- pnpm + Turborepo + Biome + TS strict + Vitest workspace + Playwright + PGlite + OTEL + pino + prom-client + GitHub Actions CI.
- 23 workspace packages scaffolded.
- 131 internal doc cross-links validated.

**Verification:** `pnpm install && pnpm biome check . && pnpm typecheck && pnpm test && pnpm bench -- --smoke` green on a clean clone.
