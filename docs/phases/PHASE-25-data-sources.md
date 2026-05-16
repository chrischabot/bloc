# Phase 25 — Data Sources Primitive

## Goal

Introduce the data-sources primitive (Notion 2025-09-03) so a database can host multiple data sources and views can link to data sources elsewhere. Both legacy `database_id` and modern `data_source_id` addressing remain supported under the dual-routing version-gate.

## Read first

- `docs/architecture/10-data-sources.md`
- `docs/api/05-versioning.md`
- `docs/api/endpoints/databases.md`
- `docs/frontend/07-database-views.md`

## Deliverables

1. Schema additions per `docs/architecture/10-data-sources.md#tables`.
2. Back-fill migration: every existing database creates a default `data_source` with the same id (identity mapping) so existing cursors remain stable; pages / views / properties are pointed at it.
3. New REST endpoints under `apps/api/src/routes/data-sources.ts`.
4. Dual-routing: existing endpoints accept `database_id` or `data_source_id` depending on `Notion-Version`; both route through the same service layer.
5. SDK additions: `client.dataSources.*` mirroring `client.databases.*`. Both namespaces continue to work.
6. Linked data sources: a separate `type='linked'` data source mirrors an upstream source with read-only schema. New rows materialise on the upstream and propagate back via the existing write path.
7. UI:
   - Data-source selector at the top of the view tabs row (hidden when one source).
   - "Linked" badge with originating database name on linked sources.
   - "Convert to linked source" entry-point in the database menu when an existing view is selected.
8. `data_source.id` propagated to every span / log line previously tagged with only `database.id`.

## Todos

- [ ] 25.1 schema + migration
- [ ] 25.2 REST endpoints
- [ ] 25.3 dual-routing version-gate
- [ ] 25.4 SDK
- [ ] 25.5 linked sources end-to-end (permission propagation included)
- [ ] 25.6 data-source selector UI
- [ ] 25.7 conversion flows (database → multi-source; existing view → linked)
- [ ] 25.8 contract / SDK-progressive / chaos / obs / benchmark green
- [ ] 25.9 cross-version migration test
- [ ] 25.10 visual regression for selector + linked badge

## Definition of Done

- Universal DoD.
- A fixture created under `Notion-Version: 2022-06-28` reads back identically under `2026-04-01`, with the latter additionally exposing `data_source_id` fields.
- The official `@notionhq/client` ≥ 2.4.0 (which knows data sources) drives the same CRUD operations against our server with no client-side changes; assertion in SDK-progressive.

## Pitfalls

- The migration must be idempotent and survive partial application. Wrap the per-database back-fill in a per-database transaction.
- A linked data source's `permission_signature` must be revalidated on the upstream's ACL change. Use the existing permission-cache version counter as the invalidation handle.
- A view bound to a linked data source can carry view-local filters / sorts / hidden columns, but **not** schema mutations. Reject schema-mutation PATCHes against linked-source-backed view configs with `422` and `code: linked_source_read_only`.