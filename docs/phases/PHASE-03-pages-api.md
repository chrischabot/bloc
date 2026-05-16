# Phase 3 — Pages API

## Goal

REST surface for pages per `docs/api/endpoints/pages.md`.

## Read first

- `docs/api/endpoints/pages.md`
- `docs/api/schemas/property-types.md`
- `docs/api/schemas/parent-objects.md`

## Deliverables

1. Route handlers in `apps/api/src/routes/pages.ts`:
   - `POST /v1/pages`
   - `GET /v1/pages/:id`
   - `PATCH /v1/pages/:id`
   - `GET /v1/pages/:id/properties/:property_id`
2. SDK in `packages/sdk/src/pages.ts`:
   - `client.pages.create`, `.retrieve`, `.update`, `.properties.retrieve`.
3. Title property always required for database-parent pages.
4. Icon and cover round-trip (emoji / external / file).
5. Property item paginated retrieval for `relation`, `people`, `title`, `rich_text`, `rollup` arrays.
6. Contract tests, SDK-progressive tests, chaos tests, observability assertions, benchmark report.

## Todos

- [ ] 3.1 POST create
- [ ] 3.2 GET retrieve
- [ ] 3.3 PATCH update / archive
- [ ] 3.4 GET properties/:id paginated
- [ ] 3.5 Title required-on-create rule
- [ ] 3.6 Icon + cover variants
- [ ] 3.7 Contract / SDK / chaos / obs / benchmark green

## Definition of Done

- Universal DoD.
- Creating a page with `children` populates the block tree atomically (rollback on any child invalid).
- Updating `archived: true` recursively soft-archives descendants.