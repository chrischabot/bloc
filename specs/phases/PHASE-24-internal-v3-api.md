# Phase 24 — Internal v3 API Parity

## Goal

Implement the internal v3 surface (`www.notion.so/api/v3/*`) so reverse-engineered clients (`react-notion-x`, `notion-py`, `notionapi`) can talk to our server with no code changes, and our own web client uses v3 for surgical per-block updates and live observation.

## Read first

- `docs/architecture/09-internal-v3-api.md` (normative)
- `docs/architecture/03-data-model.md`
- `docs/architecture/05-realtime-architecture.md`
- The reverse-engineering references listed in `09-internal-v3-api.md#reverse-engineered-references`

## Deliverables

1. `apps/api/src/routes/internal-v3.ts` registering every endpoint in the catalogue.
2. `packages/db/src/v3-record-map.ts` materialising a `recordMap` from the relational schema for any list of `(table, id)` requests, with permission filtering applied per record.
3. `packages/db/src/v3-ops/<command>.ts` per operation command (`set`, `update`, `listAfter`, `listBefore`, `listRemove`, `setPermissionItem`), each implementing the documented semantics against the same write path the public PATCH endpoints use.
4. `packages/shared/src/v3-inline.ts` codec round-tripping every annotation combination between v3 positional segments and v1 rich-text objects.
5. `apps/api/src/middleware/cookie-auth.ts` validating `token_v2`, refreshing silently when within 7 days of expiry, and falling back cleanly when both bearer and cookie are present (bearer wins, audit notes the dual-auth attempt).
6. Long-poll `getPublicPageData` + modern WS observation channel (`/v1/observation`) plumbed into the same Redis pub/sub as the public realtime gateway.
7. `tests/v3-parity/` conformance harness:
   - Mounts `<NotionRenderer/>` from `react-notion-x` over a `recordMap` fetched from our server.
   - Snapshots the rendered DOM.
   - Compares against a captured snapshot from a real notion.so render (anonymised, per the screenshot policy).
   - Fails if structural divergence exceeds the documented behavioural tolerance.

## Todos

- [ ] 24.1 recordMap builder
- [ ] 24.2 inline format codec round-trip
- [ ] 24.3 read endpoints: loadPageChunk / loadBlockSubtree / getRecordValues / syncRecordValues
- [ ] 24.4 query endpoints: queryCollection / queryCollectionV2
- [ ] 24.5 submitTransaction + every operation command
- [ ] 24.6 cookie auth + token_v2 issuance
- [ ] 24.7 long-poll + WS observation
- [ ] 24.8 loadUserContent / searchPagesWithParent / enqueueTask / getTasks
- [ ] 24.9 conformance harness with react-notion-x
- [ ] 24.10 service-layer normalisation: v1 PATCH and v3 submitTransaction converge
- [ ] 24.11 chaos: malformed transactions, version mismatch, oversized recordMap
- [ ] 24.12 observability spans

## Definition of Done

- Universal DoD.
- `tests/v3-parity/` snapshots match captured references (modulo documented behavioural differences).
- A v3 `submitTransaction` and a v1 `PATCH /v1/blocks/{id}/children` for the equivalent edit produce identical Postgres state, asserted by `tests/integration/v1-v3-equivalence.test.ts`.

## Pitfalls

- The v3 inline format is **positional**; the v1 surface is **object-keyed**. The codec must preserve mark order and link targets when one segment carries multiple marks (e.g. bold + italic + link → `["text", [["b"],["i"],["a","url"]]]`).
- `version` is per-record and monotonic; clients use it as the last-write-wins arbiter. Increment it on every server-side mutation; reject `submitTransaction` operations whose `args` reference a stale version with `409 conflict_error`.
- The `parent_table` field can disagree with `parent_type` from the public API (`parent_table: 'block'` vs `parent_type: 'page'` for top-level blocks under a page). The mapping is documented in `09-internal-v3-api.md`; the codec applies it on serialise.