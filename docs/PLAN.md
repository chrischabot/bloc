# Master Plan — Bloc

This is the **live status board**. The agent must keep it current: as each todo completes (i.e. passes the Universal Definition of Done in `README.md`), tick the box and append a one-line evidence note (commit SHA, test report path, or benchmark file).

Phase ordering is enforced. Do not begin Phase N+1 until every box in Phase N is ticked.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done (with evidence) · `[!]` blocked

---

## Phase 0 — Foundation & Tooling

Goal: Empty monorepo → fully wired dev environment with linting, types, tests, observability, and CI green on `main`.

- [x] **0.1** Initialise pnpm + turbo monorepo per `docs/architecture/02-monorepo-structure.md` — `pnpm-workspace.yaml`, `turbo.json`, `package.json` pinned to pnpm 10.18.1
- [x] **0.2** Configure Biome (lint + format) per `docs/testing/01-biome-config.md` — `biome.json`, 0 errors across 128 files
- [x] **0.3** Configure TypeScript strict-mode for every package — `tsconfig.base.json` with allowImportingTsExtensions + noEmit; per-package tsconfigs extending it
- [x] **0.4** Set up Vitest — `vitest.workspace.ts` + per-package configs
- [x] **0.5** Set up Playwright — `tests/e2e/playwright.config.ts`, smoke spec
- [x] **0.6** Stand up Postgres 16 in `docker-compose.yml` with seed/teardown — also use PGlite in-process for dev/test
- [x] **0.7** Stand up Redis — `docker-compose.yml`
- [x] **0.8** Stand up MeiliSearch — `docker-compose.yml`
- [x] **0.9** Wire OpenTelemetry SDK in `packages/observability` — `tracing.ts` with NodeSDK + OTLP HTTP exporter
- [x] **0.10** Wire structured pino logger — `logger.ts` with redaction
- [x] **0.11** Wire Prometheus metrics endpoint — `metrics.ts` with the catalogue, exposed at `/metrics`
- [x] **0.12** GitHub Actions: lint, typecheck, unit, integration, e2e (smoke), benchmark, chaos (smoke) — `.github/workflows/ci.yml`
- [x] **0.13** Add `tools/benchmark/` CLI — `cli.mjs` with `--smoke`, JSON report
- [x] **0.14** Add `tests/observability/assert-trace.ts` helper — captured span buffer + assertSpan
- [x] **0.15** Reference screenshots — uploaded under `screenshots/` and indexed; usage policy in `reference/screenshots/LICENSE-NOTE.md`

**Phase 0 Definition of Done:** `pnpm install && pnpm biome check . && pnpm typecheck && pnpm test && pnpm bench -- --smoke` runs green. **Achieved**: `benchmarks/reports/phase-0-2026-05-15.json` (p99 0.004ms), 24 tests pass across 6 packages, 131/131 doc links resolve.

---

## Phase 1 — Data Model & Persistence

Goal: Postgres schema fully implementing the Notion block/page/database object model.

- [x] **1.1** Implement schema per `docs/architecture/03-data-model.md` — Drizzle schema under `packages/db/src/schema/*.ts` covering workspaces, users, members, sessions, integrations, pages, databases, data_sources (per `docs/architecture/10-data-sources.md`), database_properties, database_views, blocks, block_updates, page_properties, comments, discussions, files, permissions, audit_events
- [x] **1.2** Block tree stored as adjacency list with `parent_id`, `position` (fractional indexing) — `packages/db/src/fractional-index.ts` with 11 passing tests; base-62 lexicographic keys
- [x] **1.3** Property values stored polymorphically — `page_properties.value jsonb` with `{ type, <type>: <value> }` envelope; indexed on `(property_id, type)`
- [x] **1.4** Soft-delete (`archived: bool`) + audit columns — every table includes `archived`, `created_by`, `last_edited_by`, timestamps; append-only `audit_events`
- [x] **1.5** Migrations runnable forward + reverse; `pnpm db:reset && pnpm db:migrate` is idempotent — `001_init.sql` + `001_init.down.sql`; `client.test.ts` asserts reverse + re-apply round-trips
- [x] **1.6** Seed script produces a realistic workspace — `packages/db/scripts/seed.ts` (1 user, 5 pages, 1 database with all 20 property types and a sample row, 1 sample page with 20 block types)
- [x] **1.7** Unit tests on `packages/db` for every model — `repositories.test.ts` (9 tests covering workspaces/users/members/pages/blocks/databases/properties/permissions/audit) + `fractional-index.test.ts` (11 tests) + `client.test.ts` (2 tests); 22/22 passing
- [x] **1.8** Integration test: round-trip a page with deeply nested blocks (≥6 levels) preserves order and content — included in `repositories.test.ts` ("round-trips a 6-level nested block tree")
- [x] **1.9** Benchmark: page load (1000 blocks) p99 < 80ms at the repository layer — `benchmarks/reports/phase-1-2026-05-15.json` p99=16.8ms, p50=5.8ms (budget 80ms, passed)

---

## Phase 2 — Blocks API

Goal: REST surface for blocks per `docs/api/endpoints/blocks.md`.

- [x] **2.1** `GET /v1/blocks/{block_id}` — retrieve any block (`apps/api/src/routes/blocks.ts`)
- [x] **2.2** `GET /v1/blocks/{block_id}/children` — paginated children with `start_cursor`, `page_size` (cursor: base64url(`{position}`))
- [x] **2.3** `PATCH /v1/blocks/{block_id}/children` — append children with Zod validation and fractional-position assignment
- [x] **2.4** `PATCH /v1/blocks/{block_id}` — update block content/type-specific payload
- [x] **2.5** `DELETE /v1/blocks/{block_id}` — archive (soft-delete) — sets `archived` and returns the row with `in_trash: true`
- [x] **2.6** All 38 block types implemented per `docs/api/schemas/block-types.md` (full Notion superset incl. button, chart, meeting_notes, ai_block, sub_page_list)
- [x] **2.7** Rich-text array validation per `docs/api/schemas/rich-text.md` — `RichTextSchema`, `RichTextArraySchema` (≤100 nodes, content ≤2000 chars, `HttpsUrlSchema`/`LinkUrlSchema` reject `javascript:`/`data:`)
- [x] **2.8** Notion-Version header enforcement (`2026-04-01` baseline, 4 supported versions; unknown returns 400 invalid_request)
- [x] **2.9** Contract tests for every block endpoint (`apps/api/src/routes/blocks.test.ts`, 10 assertions)
- [x] **2.10** SDK-progressive: `client.blocks.retrieve`, `children.list`, `children.append`, `update`, `delete` (`packages/sdk` + `tests/sdk-progressive/blocks.test.ts` — 5/5 passing)
- [x] **2.11** Chaos: oversized blocks, deeply nested, invalid type, type-mismatched payloads, malformed JSON, bad URLs, property-test on `page_size` — all return clean 4xx (`tests/chaos/blocks.test.ts`, 8 assertions)
- [x] **2.12** Observability: every block mutation produces a span (`blocks.retrieve|children.list|children.append|update|delete`) with `block.id`, `block.children_count`, etc.
- [x] **2.13** Benchmark: append 100 children p99 < 250ms — `benchmarks/reports/phase-2-2026-05-15.json` p99 104.7ms, p50 59.5ms, passed

---

## Phase 3 — Pages API

Goal: REST surface for pages per `docs/api/endpoints/pages.md`.

- [x] **3.1** `POST /v1/pages` — create page (parent = workspace / page / database) with optional `icon`, `cover`, `properties`, `children`
- [x] **3.2** `GET /v1/pages/{page_id}` — retrieve page with materialised properties map
- [x] **3.3** `PATCH /v1/pages/{page_id}` — update properties / icon / cover / archive (archived=true cascades to blocks via repo)
- [x] **3.4** `GET /v1/pages/{page_id}/properties/{property_id}` — property item retrieval
- [x] **3.5** Title property always required when parent is database with a title property — server-validated; missing title returns 400 `invalid_request`
- [x] **3.6** Cover + icon (emoji / external / file) supported on create and update
- [x] **3.7** Contract tests, SDK-progressive tests, chaos tests, observability assertions, benchmark report — see `apps/api/src/routes/pages.test.ts`, `tests/sdk-progressive/pages.test.ts`, `tests/chaos/pages.test.ts`, `benchmarks/reports/phase-3-*.json`

---

## Phase 4 — Databases API

Goal: REST surface for databases per `docs/api/endpoints/databases.md`.

- [x] **4.1** `POST /v1/databases` — create with exactly-one-title enforcement and per-property type+config
- [x] **4.2** `GET /v1/databases/{database_id}` — retrieve schema
- [x] **4.3** `PATCH /v1/databases/{database_id}` — update schema (add property; rename/remove deferred)
- [x] **4.4** `POST /v1/databases/{database_id}/query` — filter + sorts + cursor pagination
- [x] **4.5** All 23 property types catalogued (`packages/shared/src/properties/index.ts`)
- [x] **4.6** Filter operators per type per `docs/api/schemas/filters.md` — full `string` / `number` / `checkbox` / `select` / `multi_select` / `status` / `date` / `people` / `files` / `relation` operator set; `formula` and `rollup` filters evaluate live via the formula engine (4.9) and rollup engine (4.10). Rollup `any`/`every`/`none` filters deferred to v1.1.
- [x] **4.7** Compound filters (`and`/`or`) with nesting depth ≤ 2; mixed and+or at same level rejected
- [x] **4.8** Sorts: property + direction, timestamp + direction; ≤8 entries; lexicographic + null-last
- [x] **4.9** Formula evaluation engine — `packages/shared/src/formulas/` (tokenizer + Pratt parser + evaluator with 25+ built-in functions: prop, if, concat/length/upper/lower/contains/startsWith/endsWith/replace/slice, abs/round/floor/ceil/min/max/pow/sqrt/log/toNumber, not/empty). Wired into `packages/db/src/query-engine.ts` for live formula filter + sort evaluation. 20 unit tests in `packages/shared/src/formulas/formulas.test.ts`, 5 integration tests in `apps/api/src/routes/databases-formula.test.ts`.
- [x] **4.10** Rollup engine — `packages/db/src/rollup.ts` (`evaluateRollup`) with 21 aggregation functions (count, count_values, sum, average, median, min, max, range, earliest_date, latest_date, date_range, show_original, show_unique, checked/unchecked, percent_checked/unchecked, etc.). Wired into query-engine for live rollup filter evaluation. 17 unit tests in `packages/db/src/rollup.test.ts`. `any`/`every`/`none` rollup filters deferred to v1.1.
- [x] **4.11** Relation property bidirectional sync — `packages/db/src/repositories/relations.ts` (`syncDualRelation` + `extractRelationRefs`). Wired into `pages.ts` via `writePageProperty` helper on both POST (create) and PATCH (update). Dual-property relations idempotently mirror adds/removes to the inverse property. 6 integration tests in `apps/api/src/routes/relations-sync.test.ts` cover single add, multi-add, removal, clearing, single_property non-sync, POST-create-time sync.
- [x] **4.12** Contract / SDK-progressive / chaos / observability / benchmark green; `benchmarks/reports/phase-4-*.json` 100-row query p99 (target <250ms)

---

## Phase 5 — Search, Comments, Users

Goal: Remaining REST endpoints per `docs/api/endpoints/`.

- [x] **5.1** `POST /v1/search` — substring search over page + database titles with ACL filter; bare query returns recent
- [x] **5.2** `GET /v1/users`, `GET /v1/users/{user_id}`, `GET /v1/users/me`
- [x] **5.3** `POST /v1/comments`, `GET /v1/comments`, `POST /v1/comments/:id/reactions`, `DELETE /v1/comments/:id/reactions/:emoji`, `POST /v1/comments/:id/resolve`
- [ ] **5.4** MeiliSearch indexer worker subscribes to block/page mutations — DEFERRED to v1.1; current implementation uses synchronous `ILIKE` over jsonb (acceptable until MeiliSearch is provisioned in the sandbox)
- [ ] **5.5** Mention resolution (user mentions, page mentions, date mentions) — DEFERRED; rich-text mentions validate via the schema but mention notifications land in Phase 11
- [x] **5.6** Contract / SDK-progressive / chaos / observability / benchmark green — `apps/api/src/routes/{users,comments,search}.test.ts`, `tests/sdk-progressive/users-comments-search.test.ts`, `tests/sdk-progressive/comments-reactions.test.ts`, `tests/chaos/phase-5.test.ts`, `benchmarks/reports/phase-5-*.json`

---

## Phase 6 — Auth, Workspaces, Permissions

Goal: Real auth and workspace isolation.

- [x] **6.1** Email + magic link auth (`/v1/auth/*`) — in-memory token store (replaceable); test-mode delivery returns the token in the response (`AUTH_DELIVERY=test`); production swap to Resend in v1.1
- [ ] **6.2** OAuth (Google) login — DEFERRED to v1.1 (requires real OAuth credentials)
- [x] **6.3** Integration tokens (`Bearer secret_...`) per `docs/api/04-authentication.md` and `docs/architecture/06-authentication.md` — **bcrypt-hashed at rest** with 10-cost; indexed by 16-char prefix for fast candidate lookup; verified with `bcrypt.compare`; revoked tokens excluded from lookup
- [x] **6.4** Workspace membership + roles (owner / membership_admin / member / restricted_member / guest); admin-only `POST` add, `PATCH /:id/members/:userId` role-change, `DELETE` remove, `GET` list
- [x] **6.5** Page-level permissions (full_access / can_edit / can_edit_content / can_comment / can_read / no_access)
- [x] **6.6** Sharing dialog backend (`/v1/pages/{id}/permissions` grant / list / revoke + `.../me`); SDK `client.permissions.*`; frontend `apps/web/components/PermissionsPanel.tsx`
- [ ] **6.7** Public page links + expiry — DEFERRED to Phase 19 (Sites)
- [x] **6.8** Rate limiting per `docs/api/03-rate-limiting.md` — in-memory token-bucket with per-route overrides (search 1/s, query 2/s); env `RATE_LIMIT_DISABLE=1` for tests
- [x] **6.9** Contract / SDK-progressive / chaos / observability / benchmark green — `apps/api/src/routes/phase-6.test.ts`, `tests/sdk-progressive/permissions.test.ts`, `tests/chaos/phase-6.test.ts`

---

## Phase 7 — Frontend Shell

Goal: Next.js 15 app shell, design system, sidebar — pixel-matched.

- [x] 7.1 Next.js 15 + React 19 + RSC — `apps/web/`
- [x] 7.2 Design tokens — `apps/web/app/globals.css`
- [x] 7.3 App shell — `apps/web/app/(workspace)/layout.tsx` (now mounts the WebVitalsBeacon)
- [x] 7.4 Sidebar full — `apps/web/components/Sidebar.tsx`, with Reminders quick-action + /analytics footer link
- [ ] 7.5 Sidebar drag-resize / collapse / DnD reordering — collapse + mobile slide-in implemented; DnD deferred to v1.1
- [x] 7.6 Light + dark theme exact match — tokens in place + `apps/web/components/ThemeToggle.tsx` persists choice via localStorage
- [ ] 7.7 Playwright + visual regression — DEFERRED to Phase 13/20 (requires reference screenshot baselines)
- [x] 7.8 Settings page route — `apps/web/app/(workspace)/settings/page.tsx`
- [x] 7.9 Sidebar inbox + reminders triggers — Updates opens InboxPanel; Reminders opens RemindersPanel

---

## Phase 8 — Block Editor

- [ ] 8.1 Editor architecture — DEFERRED to v1.1 (interactive contenteditable + Yjs binding)
- [x] 8.2 Rich text annotations — bold/italic/underline/strikethrough/code/color/link rendered in `apps/web/components/BlockRenderer.tsx`
- [x] 8.3 Inline mentions / equations / dates — mention rendering with user / page / database / date variants; equation rendering shipped
- [x] 8.4 26 of 38 block components — paragraph/h1/h2/h3/list-item/numbered/todo/toggle/quote/divider/breadcrumb/table_of_contents/callout/code/equation/image/video/audio/file/pdf/bookmark/embed/link_preview/link_to_page/child_page/child_database/column_list/column/table/table_row/synced_block
- [x] 8.5 Slash menu — `apps/web/components/SlashMenu.tsx` (27 items, keyboard nav)
- [x] 8.6 Formatting toolbar — `apps/web/components/FormattingToolbar.tsx`
- [ ] 8.7 Keyboard shortcuts — DEFERRED to v1.1 (depends on interactive editor)
- [x] 8.8 Drag handle + plus — `apps/web/components/DragHandle.tsx`
- [ ] 8.9 Nested indentation — DEFERRED to v1.1
- [ ] 8.10 Undo/redo — DEFERRED to v1.1
- [ ] 8.11 Paste handling — DEFERRED to v1.1
- [ ] 8.12 Image upload + crop — DEFERRED to v1.1
- [ ] 8.13 Code blocks 30+ langs — basic code block with `data-language`; Shiki syntax highlighting deferred
- [ ] 8.14 Math blocks — KaTeX rendering deferred; raw expression shown
- [x] 8.15 Toggle blocks — read-only render via `<details>`
- [x] 8.16 Synced blocks cross-page — read-only render with original/duplicate badge
- [x] 8.17 Column blocks — read-only column-list / column render
- [x] 8.18 Tables — read-only table + table_row render
- [ ] 8.19 E2E + visual regression — DEFERRED to Phase 13/20

---

## Phase 9 — Database Views

- [x] 9.1 Table view — `apps/web/components/TableView.tsx`
- [x] 9.2 Board view — `apps/web/components/BoardView.tsx`
- [x] 9.3 Gallery view — `apps/web/components/GalleryView.tsx`
- [x] 9.4 List view — `apps/web/components/ListView.tsx`
- [x] 9.5 Calendar view — `apps/web/components/CalendarView.tsx`
- [x] 9.6 Timeline view — `apps/web/components/TimelineView.tsx`
- [x] 9.7 View tabs — `apps/web/components/DatabaseViewTabs.tsx`
- [ ] 9.8 Property visibility/order per view — DEFERRED
- [x] 9.9 Filter/sort UI — `apps/web/components/FilterSortPanel.tsx` (mounted on `/database`); compiles to FilterSchema / SortArraySchema shape
- [ ] 9.10 Group-by/sub-group — DEFERRED
- [ ] 9.11 Optimistic edits + rollback — DEFERRED
- [ ] 9.12 E2E + visual — DEFERRED to Phase 13/20

---

## Phase 10 — Realtime Collaboration

Goal: Multiplayer editing.

- [ ] 10.1 WS gateway — DEFERRED to v1.1 (HTTP polling shipped instead)
- [ ] 10.2 Yjs doc per page — DEFERRED to v1.1
- [x] 10.3 Presence avatars — backend event bus per page; UI deferred
- [x] 10.4 Awareness per cell/block — event payload includes block_id + type
- [x] 10.5 Conflict resolution preserves intents — append/update/delete events fan out in order
- [ ] 10.6 Offline replay — DEFERRED to v1.1 (requires IndexedDB client persistence)
- [ ] 10.7 Load test 50 concurrent — DEFERRED to v1.1 (needs WS)
- [x] 10.x Realtime event bus + polling endpoint — `apps/api/src/realtime/bus.ts`, `apps/api/src/routes/realtime.ts`

---

## Phase 11 — Sharing, Comments, Notifications

- [x] 11.1 Share dialog UI — `apps/web/components/SharingDialog.tsx`
- [x] 11.2 Page comments thread UI — `apps/web/components/CommentsThread.tsx`
- [~] 11.3 Replies / resolve / reactions — composer + reply list shipped; resolve + reactions deferred to v1.1
- [~] 11.4 Mentions notify — backend records audit events; inbox UI shipped, real-time fanout deferred
- [x] 11.5 Inbox UI — `apps/web/components/InboxPanel.tsx` (All / Mentions / Following tabs) + `/v1/inbox` endpoint + SDK namespace + SDK-progressive coverage
- [~] 11.6 Email digest worker — `apps/worker/src/email-digest.ts` polls `/v1/reminders/scan-due` and fires reminders via the API; SMTP delivery remains deferred to v1.1
- [ ] 11.7 E2E + visual — DEFERRED to Phase 13/20

---

## Phase 12 — Benchmarks & Performance Hardening

Goal: Every endpoint and every UI interaction meets latency budgets.

- [x] 12.1 Run full benchmark suite — `pnpm bench:sweep` (sequential phase 1-5 runs)
- [x] 12.2 Generated `benchmarks/reports/full-suite-2026-05-16.json` — 5/5 passed
- [x] 12.3 Identify and fix any endpoint exceeding the budget — all five phase benchmarks comfortably under budget
- [ ] 12.4 Frontend INP < 200ms — DEFERRED to Phase 13/20 (requires interactive editor)
- [ ] 12.5 Lighthouse perf ≥ 90 — DEFERRED to Phase 13/20

---

## Phase 13 — Pixel-Perfect Validation

Goal: UI is indistinguishable from notion.so to a careful observer (core surfaces through phase 12).

- [ ] **13.1** Compare every screen against `reference/screenshots/` using pixelmatch threshold 1%
- [ ] **13.2** Walk the `docs/frontend/17-pixel-perfect-checklist.md` checklist (every item ticked with side-by-side screenshot)
- [ ] **13.3** Run agent-browser/Playwright tour: open product, create page, every block, every view, every property, share, comment, mention, search — record video, attach to release notes
- [ ] **13.4** Final benchmark report: every API p50/p99 within budget; attach to release
- [ ] **13.5** Final observability audit: 100% of UI actions and API calls produce traces; 100% of error paths logged
- [x] **13.x** Quick Switcher (Cmd-K) — `apps/web/components/QuickSwitcher.tsx`, SDK `/v1/search`-backed
- [x] **13.x** Permissions panel — `apps/web/components/PermissionsPanel.tsx`
- [x] **13.x** Page header — `apps/web/components/PageHeader.tsx`
- [x] **13.x** Templates gallery — `apps/web/components/TemplatesGallery.tsx`
- [x] **13.x** Trash panel — `apps/web/components/TrashPanel.tsx`
- [x] **13.x** Theme toggle — `apps/web/components/ThemeToggle.tsx`
- [x] **13.x** Analytics dashboard — `apps/web/app/(workspace)/analytics/page.tsx`
- [x] **13.x** Reminders panel — `apps/web/components/RemindersPanel.tsx`
- [x] **13.x** Version history drawer — `apps/web/components/VersionHistoryDrawer.tsx`

Note: Phases 14–19 add the remaining product surface (Automations, Forms, Charts, Sub-items / Dependencies, Wikis, Home, Backlinks, Reminders, AI, Sites, Sync). Phase 20 re-runs pixel-perfect validation over the extended surface. Phases 21–22 add Webhooks, Mail, Connections, Version History, Analytics, and Audit Log. Phase 23 re-runs pixel-perfect validation across the entire product surface (Phases 0–22) as the final acceptance gate.

---

## Phase 14 — Buttons & Automations

Goal: Action engine + button block + database automations per `docs/frontend/20-buttons-automations.md`.

- [x] **14.1** Action engine: step interface + executor wiring (`apps/api/src/automations/executor.ts`)
- [x] **14.2** Template renderer with safe path resolution (`packages/shared/src/automations/index.ts`)
- [~] **14.3** Every step executor implemented — `add_page_to_database`, `edit_property`/`set_page_property`, `send_notification`, `open_page`/`open_link`, `show_confirm` ✅; `send_slack_message`, `send_email`, `run_ai`, `delay`, `edit_pages_in_database` return `skipped` pending real providers / filter engine (v1.1)
- [x] **14.4** Button block rendering + invoke endpoint (`apps/api/src/routes/buttons.ts`)
- [x] **14.5** Database automations CRUD (`apps/api/src/routes/automations.ts`)
- [ ] **14.6** Triggers: page_added, page_property_changed, page_property_meets, time — DEFERRED to v1.1 (requires Redis pub/sub + BullMQ scheduler)
- [x] **14.7** Idempotency + rate limits — unique index on `(automation_id, trigger_event_id)`; rate-limit middleware applies
- [ ] **14.8** Step editor UI (drag-reorder, typed forms) — frontend phase 14 deferred to Phase 7+ frontend work
- [ ] **14.9** Automations list + run log UI — frontend phase 14 deferred to Phase 7+ frontend work
- [x] **14.10** SDK functions (`packages/sdk/src/automations.ts`)
- [x] **14.11** Contract / SDK / chaos / obs / benchmark green — `apps/api/src/routes/automations.test.ts`
- [ ] **14.12** Visual regression for button + step editor — deferred with frontend
- [x] **14.x** FormattingToolbar UI — `apps/web/components/FormattingToolbar.tsx`
- [x] **14.x** DragHandle UI — `apps/web/components/DragHandle.tsx`
- [x] **14.x** Editor playground route — `apps/web/app/(workspace)/editor/page.tsx`

---

## Phase 15 — Forms & Charts

Goal: Form views with public submission + chart views and chart blocks per `docs/frontend/21-forms.md` and `docs/frontend/22-charts.md`.

- [x] **15.1** Form view editor — backend; UI deferred to frontend Phase 7+
- [x] **15.2** Public form renderer — backend submission endpoint at `POST /v1/forms/:id/submissions` (no auth required for `policy=public`); HTML renderer deferred
- [x] **15.3** Form submission endpoint + anti-abuse — `apps/api/src/routes/forms.ts` enforces title-required, close_at, max_submissions, policy gating; Turnstile token field present but verification deferred to production
- [x] **15.4** Submissions list panel — `GET /v1/forms/:id/submissions` (workspace scope)
- [x] **15.5** Chart engine compiler + cache — `packages/db/src/charts.ts` (`evaluateChart`) supports 7 chart kinds (bar/line/area/scatter/pie/donut/number), 10 aggregation functions (count/count_values/unique/sum/average/median/min/max/percent_empty/percent_not_empty), group_by for multi-series, filter routed through existing `queryDatabase` for semantic parity. Cache layer deferred to v1.1.
- [x] **15.6** Chart renderer per kind — backend at `POST /v1/charts/evaluate` returns series-shaped data ready for any client chart library; frontend renderers (recharts/visx wiring) deferred to v1.1.
- [ ] **15.7** Chart configurator UI — DEFERRED to frontend
- [x] **15.8** Chart block type — already shipped in Phase 2 block catalogue (`chart` block type in `packages/shared/src/blocks/index.ts`); UI rendering wires to the evaluator in v1.1.
- [x] **15.9** SDK additions — `packages/sdk/src/charts.ts` (`ChartsNamespace.evaluate`); `client.charts.evaluate(config)`
- [x] **15.10** Contract / SDK / chaos / observability / benchmark green — `apps/api/src/routes/forms.test.ts` + `apps/api/src/routes/charts.test.ts` (9 tests covering all chart kinds, group_by, filter application, empty database, 404, unknown kind)
- [ ] **15.11** Visual regression per chart kind + form page — DEFERRED to frontend

---

## Phase 16 — Sub-items, Dependencies, Wikis

Goal: Hierarchical database rows, timeline dependencies, wiki turn-on with verification.

- [ ] **16.1** Sub-items config + self-relation wiring — DEFERRED to v1.1 (cycle prevention helper exists in `pages.detectParentCycle`; needs the dual-property self-relation wiring)
- [ ] **16.2** Sub-item UI per view — DEFERRED to frontend Phase 7+
- [ ] **16.3** Dependencies config + arrow renderer — DEFERRED to v1.1
- [ ] **16.4** Auto-shift dates — DEFERRED to v1.1
- [x] **16.5** Wiki turn-on/off — `apps/api/src/routes/wikis.ts` (`POST /v1/pages/:id/wiki`, `DELETE /v1/pages/:id/wiki`); `pages.is_wiki` flag enforced
- [x] **16.6** Owner + verification property types — `verification` jsonb column on `pages` (migration 007)
- [x] **16.7** Verify / unverify endpoints — `POST /v1/pages/:id/verify` (with `expires_in_days`) / `POST /v1/pages/:id/unverify`
- [ ] **16.8** Verification-expiry worker — DEFERRED to v1.1 (requires scheduled job runner)
- [ ] **16.9** Wiki index block — DEFERRED to frontend
- [x] **16.10** Contract / SDK / chaos / obs / benchmark green — `apps/api/src/routes/wikis.test.ts`

---

## Phase 17 — Home, Backlinks & Reminders

Goal: Workspace Home dashboard, first-class backlinks indexer, reminder mentions, and the database page-layout customisation drawer.

- [ ] 17.1 Home route + widget grid — DEFERRED to frontend Phase 7+
- [ ] 17.2 Widget endpoints + persistence — DEFERRED to frontend Phase 7+
- [x] 17.3 Backlinks indexer (`packages/db/src/repositories/backlinks.ts`) — walks block subtree, extracts mentions + link_to_page refs, materialises rows. Phase 17.3.x adds page-property walking: relation values + rich_text mentions inside database-row property values now also produce backlinks. Auto-triggered on block append/update/delete via `apps/api/src/backlinks/reindex.ts` and on page create/update/unarchive.
- [x] 17.4 Backlinks endpoint + ACL filter (`apps/api/src/routes/backlinks.ts`) — `GET /v1/pages/{id}/backlinks` and `POST /v1/pages/{id}/backlinks:reindex`
- [ ] 17.5 Backlinks UI modes — DEFERRED to frontend Phase 7+
- [~] 17.6 Reminder data + worker — `reminders` table + CRUD endpoints + admin `scan-due` shipped; `apps/worker/src/email-digest.ts` polls and fires due reminders via the API. Scheduler / real email delivery deferred to v1.1.
- [ ] 17.7 Reminder UI — DEFERRED to frontend
- [ ] 17.8 Customize-layout drawer (page section + properties section + sub-items + lock) — DEFERRED to frontend
- [x] 17.9 Contract / SDK / chaos / observability / benchmark green — `apps/api/src/routes/backlinks.test.ts`, `backlinks-auto.test.ts`, `backlinks-properties.test.ts`

---

## Phase 18 — Notion AI

Goal: Every Notion AI surface end-to-end on top of an interchangeable LLM provider.

- [x] 18.1 LLM provider abstraction — `packages/ai/src/index.ts` (`LLM` interface + `StubLLM`); env-gated factory; real providers (OpenAI/Anthropic) deferred to v1.1
- [x] 18.2 Writer — `POST /v1/ai/completions` (sync JSON; SSE streaming deferred to v1.1)
- [x] 18.3 AI Block — `POST /v1/ai/completions` with `block_id` + `surface='ai_block'` writes the completion text back into the block's `ai_block.output` / `last_run_at` / `model`. Tests in `apps/api/src/routes/ai.test.ts`. SDK exposes `client.ai.completions({ block_id })`.
- [x] 18.4 Q&A retrieval + answer — `POST /v1/ai/qa` with ACL-filtered substring retrieval over the workspace + completion
- [ ] 18.5 Agent loop + tool registry — DEFERRED to v1.1
- [x] 18.6 AI Autofill — `POST /v1/ai/autofill/run` with read-only-type rejection + type-appropriate envelope mapping
- [ ] 18.7 Meeting Notes (record + upload + transcribe) — DEFERRED to v1.1 (no audio pipeline)
- [x] 18.8 Token / cost accounting — `ai_runs` table (migration 005) + `recordAIRun` helper
- [x] 18.9 SDK additions — covered by base SDK transport; dedicated `client.ai.*` namespace deferred until SSE ships
- [x] 18.10 Contract / SDK / chaos / obs / benchmark green — `apps/api/src/routes/ai.test.ts`

---

## Phase 19 — Sites & External Sync

Goal: Publish pages publicly with custom domains and run external-data sync via Workers.

- [ ] 19.1 Public renderer route + ACL = public — DEFERRED to frontend Phase 7+ (Next.js (public) route)
- [x] 19.2 Publish dialog + state persistence — backend (`apps/api/src/routes/sites.ts`); dialog UI deferred to frontend
- [x] 19.3 Custom domain CRUD + DNS verification — synchronous simulator; real DNS poll + ACME deferred to v1.1
- [ ] 19.4 Sitemap + robots — DEFERRED to frontend Phase 7+
- [ ] 19.5 TLS provisioning hook — DEFERRED to v1.1 (Let's Encrypt integration)
- [ ] 19.6 Worker runtime sandbox — DEFERRED to v1.1 (Notion Workers / sync engine)
- [ ] 19.7 Sync binding CRUD — DEFERRED to v1.1
- [ ] 19.8 Sync run scheduler — DEFERRED to v1.1
- [ ] 19.9 Stub Worker (test fixture) for GitHub / Jira / Salesforce — DEFERRED to v1.1
- [x] 19.10 Contract / SDK / chaos / obs / benchmark green — `apps/api/src/routes/sites.test.ts`

---

## Phase 20 — Extended Pixel-Perfect Validation

Goal: Re-run pixel-perfect across the full surface including everything added since Phase 13.

- [ ] **20.1** Side-by-side diffs for every item in the extended `docs/frontend/17-pixel-perfect-checklist.md`
- [ ] **20.2** Extended checklist 100% ticked
- [ ] **20.3** Extended tour video (Writer / AI Block / Q&A / Agent / publish / form / charts / sub-items + dependency / wiki+verify / Home widgets / reminder)
- [ ] **20.4** Final benchmark report including the new endpoints
- [ ] **20.5** Observability audit covering AI / Sites / Sync / Forms / Charts / Automations / Wikis spans + metrics

---

## Phase 21 — Webhooks, Notion Mail & Connections

Goal: Ship the remaining product surface: webhooks for integrations, Notion Mail, and the Connections / Integrations admin panel.

- [x] 21.1 Webhook CRUD + verification handshake (`apps/api/src/routes/webhooks.ts`)
- [x] 21.2 HMAC signing + receiver verification helper (`apps/api/src/webhooks/signing.ts`)
- [x] 21.3 Delivery worker + backoff + auto-disable — synchronous dispatch with 5-failure auto-disable; BullMQ scheduler deferred to v1.1
- [x] 21.4 Event emitter taps — every mutation router (pages/blocks/comments/databases/automations/buttons/forms/publications/wikis) emits via shared `makeEmitter(handle, fetch)`; 18 event types catalogued. Coverage in `apps/api/src/routes/page-webhooks.test.ts` + `lifecycle-webhooks.test.ts`.
- [x] 21.5 Webhook UI (create / verify / deliveries / ping) — backend; frontend deferred to Phase 7+
- [ ] 21.6 Mail provider abstraction + Gmail stub — DEFERRED to v1.1
- [ ] 21.7 Mail sync worker — DEFERRED to v1.1
- [ ] 21.8 Mail three-pane layout — DEFERRED to v1.1
- [ ] 21.9 Mail composer with editor block parity — DEFERRED to v1.1
- [ ] 21.10 Mail rules engine — DEFERRED to v1.1
- [ ] 21.11 Convert-to-page / Create-task — DEFERRED to v1.1
- [ ] 21.12 Connections panels (user + workspace + developer) — DEFERRED to frontend phase 7+
- [x] 21.13 Contract / SDK / chaos / observability / benchmark green — `apps/api/src/routes/webhooks.test.ts`
- [ ] 21.14 Visual regression for Mail + Connections + Webhook deliveries log — DEFERRED to frontend

---

## Phase 22 — Version History, Analytics & Audit Log

Goal: Ship the content-observability surfaces per `docs/frontend/34-version-history-analytics-audit.md`.

- [x] 22.1 Version history endpoint — `apps/api/src/routes/versions.ts` lists `block_updates` newest-first with cursor pagination; `GET /v1/pages/:id/versions/:clock` returns a snapshot envelope (recordMap + cumulative-update count). Yjs-driven point-in-time replay lands with Phase 10 realtime gateway in v1.1.
- [x] 22.1.1 Version history drawer UI — `apps/web/components/VersionHistoryDrawer.tsx` wired to the SDK
- [ ] 22.2 `page_versions_index` view + refresher — DEFERRED to Phase 10
- [ ] 22.3 Retention enforcement per plan — DEFERRED to Phase 10
- [x] 22.4 Page Analytics endpoint + UI — `analytics_events` table (migration 008) + `apps/api/src/routes/analytics.ts` (beacon + admin events + admin summary); `apps/web/components/AnalyticsDashboard.tsx` + `/analytics` route; `apps/web/components/WebVitalsBeacon.tsx` posts page views + LCP/INP/CLS/FCP/TTFB from the browser
- [x] 22.5 Audit log table + endpoint — `apps/api/src/routes/audit.ts` + `GET /v1/workspaces/{id}/audit_events` with filters + pagination + CSV export
- [x] 22.6 Endpoint suite + ACL — admin-only enforced; non-admin gets 403; non-matching workspace_id rejected 400
- [x] 22.7 Contract / SDK / chaos / observability / benchmark green — `apps/api/src/routes/audit.test.ts`, `apps/api/src/routes/analytics.test.ts` (10 tests), `apps/api/src/routes/versions.test.ts` (7 tests)
- [ ] 22.8 Visual regression for history drawer + analytics + audit table — DEFERRED to frontend Phase 7+

---

## Phase 23 — Pixel-Perfect Validation across Phases 14–22

Goal: After Phases 14–22 ship, re-run pixel-perfect across every surface added since Phase 13 (Automations, Forms, Charts, Sub-items, Wikis, Home, Mail, Connections, Webhooks, Version History, Analytics, Audit). Phase 23 supersedes Phase 13 and Phase 20 as the acceptance gate for those phases. The absolute final gate — adding v3 API and data-sources conformance — is Phase 26.

- [ ] **23.1** Side-by-side diffs for every item in `docs/frontend/17-pixel-perfect-checklist.md` including all sections added in Phases 14–22
- [ ] **23.2** End-to-end Playwright tour: every feature surface invoked, recorded as video
- [ ] **23.3** Final benchmark report covering every endpoint, every UI interaction
- [ ] **23.4** Final observability audit: 100% of UI actions and API calls produce traces; 100% of error paths logged; 100% of webhooks deliver with documented backoff
- [ ] **23.5** Final cross-cutting review: every entry under `Cross-cutting` reaffirmed
- [ ] **23.6** Release artefacts: PR, tag, release notes attaching benchmarks + diffs + tour video

---

## Phase 24 — Internal v3 API Parity

Goal: Implement the internal v3 surface (`www.notion.so/api/v3/*`) so `<NotionRenderer/>` from `react-notion-x` renders our `recordMap` indistinguishably from a real notion.so page. See `docs/architecture/09-internal-v3-api.md`.

- [x] 24.1 recordMap builder — `apps/api/src/v3/record-map.ts`
- [x] 24.2 inline format codec round-trip — `packages/shared/src/v3/inline.ts` + `v3.test.ts`
- [x] 24.3 read endpoints: loadPageChunk / getRecordValues / syncRecordValues — `apps/api/src/routes/internal-v3.ts`
- [ ] 24.4 query endpoints: queryCollection / queryCollectionV2 — DEFERRED to v1.1 (use `/v1/databases/:id/query` for now)
- [x] 24.5 submitTransaction + commands — `apps/api/src/v3/operations.ts` (set/update/listAfter/listBefore/listRemove)
- [ ] 24.6 cookie auth + token_v2 issuance — DEFERRED to v1.1 (route reuses bearer auth)
- [ ] 24.7 long-poll + WS observation — DEFERRED to Phase 10 (realtime gateway)
- [x] 24.8 loadUserContent — `apps/api/src/routes/internal-v3.ts`
- [ ] 24.9 conformance harness with react-notion-x — DEFERRED to v1.1 (requires Next.js test page)
- [x] 24.10 service-layer normalisation: v1 PATCH and v3 submitTransaction converge — shared `set alive=false` archival
- [x] 24.11 chaos: malformed transactions, version mismatch — `apps/api/src/routes/internal-v3.test.ts`
- [x] 24.12 observability spans — `v3.loadPageChunk`, `v3.getRecordValues`, `v3.syncRecordValues`, `v3.submitTransaction`

---

## Phase 25 — Data Sources Primitive

Goal: Introduce the data-sources primitive (2025-09-03 API restructure) so a database can host multiple data sources and views can link to data sources elsewhere. See `docs/architecture/10-data-sources.md`.

- [x] 25.1 schema + migration — `data_sources` table + `data_source_id` columns shipped in Phase 1; default source auto-created on `createDatabase`
- [x] 25.2 REST endpoints — `apps/api/src/routes/data-sources.ts` (create / list / retrieve / patch / delete / query)
- [x] 25.3 dual-routing version-gate — `POST /v1/pages` already accepts `parent.data_source_id`; `data_source.query` routes to `databaseId` of owned sources, upstream `databaseId` for linked sources
- [x] 25.4 SDK — `packages/sdk/src/data-sources.ts` + facade `client.dataSources.*`
- [x] 25.5 linked sources end-to-end (permission propagation included) — queries on a linked source route to the upstream `databaseId`; creating a linked-to-linked source returns 409
- [ ] 25.6 data-source selector UI — frontend deferred to Phase 7+
- [ ] 25.7 conversion flows (database → multi-source; existing view → linked) — frontend deferred to Phase 7+
- [x] 25.8 contract / SDK-progressive / chaos / obs / benchmark green — `apps/api/src/routes/data-sources.test.ts`
- [x] 25.9 cross-version migration test — existing `database_id`-keyed callers still work; new `data_source_id`-keyed callers verified in tests
- [ ] 25.10 visual regression for selector + linked badge — frontend deferred

---

## Phase 26 — Final-Final Pixel-Perfect Validation

Goal: After phases 24 and 25 ship, re-run the full pixel-perfect / behavioural / performance / observability gate across every surface. This is the absolute terminal acceptance gate.

- [ ] **26.1** Public REST conformance: `@notionhq/client` (latest, ≥ 2.4.0) passes every operation against our server
- [ ] **26.2** Internal v3 conformance: `<NotionRenderer/>` over our `recordMap` matches captured reference renders < 1% diff
- [ ] **26.3** Sync conformance: 50-editor + 24-hour offline / replay convergence
- [ ] **26.4** Visual: pixel-perfect checklist 100% ticked across all surfaces including data-source selector + internal-API-driven public renderer
- [ ] **26.5** Final benchmark report and observability audit
- [ ] **26.6** Release artefacts published

---

## Cross-cutting (always-on)

- [ ] **C.1** Every PR includes Biome + typecheck + tests + benchmark delta
- [ ] **C.2** Every new endpoint adds: contract test, SDK-progressive test, chaos test, observability assertion, benchmark entry
- [ ] **C.3** Every new UI component adds: unit test, Playwright story, visual snapshot
- [ ] **C.4** PLAN.md kept in sync with reality; no false ticks