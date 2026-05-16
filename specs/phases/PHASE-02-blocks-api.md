# Phase 2 — Blocks API

## Goal

REST surface for blocks per `docs/api/endpoints/blocks.md`, byte-identical to Notion.

## Read first

- `docs/api/endpoints/blocks.md`
- `docs/api/schemas/block-types.md`
- `docs/api/schemas/rich-text.md`
- `docs/api/00-api-overview.md`
- `docs/api/01-pagination.md`
- `docs/api/02-errors.md`
- `docs/api/05-versioning.md`

## Deliverables

1. Route handlers in `apps/api/src/routes/blocks.ts`:
   - `GET /v1/blocks/:id`
   - `GET /v1/blocks/:id/children`
   - `PATCH /v1/blocks/:id/children`
   - `PATCH /v1/blocks/:id`
   - `DELETE /v1/blocks/:id`
2. `Notion-Version` middleware enforced on all routes.
3. Auth middleware honouring bearer or session.
4. Validation via `packages/shared/blocks/*.ts` Zod schemas.
5. Permission checks via `packages/db/src/permissions.ts`.
6. Serialiser that produces exactly the response envelope from the docs (with `plain_text` derived on rich text).
7. SDK in `packages/sdk/src/blocks.ts` mirroring `@notionhq/client`'s shape:
   - `client.blocks.retrieve({ block_id })`
   - `client.blocks.children.list({ block_id, start_cursor?, page_size? })`
   - `client.blocks.children.append({ block_id, children, after? })`
   - `client.blocks.update({ block_id, ... })`
   - `client.blocks.delete({ block_id })`
8. Contract tests for every endpoint × every block type.
9. SDK-progressive tests: every SDK function called with realistic inputs, asserted against expected response shape.
10. Chaos tests: oversized children, deeply nested, invalid type, type/payload mismatch, permission denied, malformed bearer.
11. Benchmark: append-100-children p99 < 250ms; list-100-children p99 < 100ms.

## Todos

- [ ] 2.1 GET retrieve
- [ ] 2.2 GET children list
- [ ] 2.3 PATCH children append
- [ ] 2.4 PATCH block update
- [ ] 2.5 DELETE archive
- [ ] 2.6 All 32 block types serialise/parse
- [ ] 2.7 Rich text validation
- [ ] 2.8 Notion-Version enforcement
- [ ] 2.9 Contract tests
- [ ] 2.10 SDK functions byte-match
- [ ] 2.11 Chaos suite green
- [ ] 2.12 Observability spans + log on error
- [ ] 2.13 Benchmark report < budget

## Definition of Done

- Universal DoD gates pass.
- A snapshot test compares our response shape against captured `@notionhq/client` responses (recorded under `tests/contract/__fixtures__/` from public Notion pages via integration token) and they match modulo IDs/timestamps.

## Pitfalls

- Block `type` immutability is enforced server-side; tests cover the rejection.
- `has_children` must be returned correctly even when not loaded.
- The append endpoint returns the **created** blocks (with their server-assigned IDs), not the existing children list.