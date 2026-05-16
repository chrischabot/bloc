# Phase 1 — Data Model & Persistence

## Goal

Postgres schema implementing the Notion object model end-to-end.

## Read first

- `docs/architecture/03-data-model.md` (normative)
- `docs/api/schemas/property-types.md`
- `docs/api/schemas/block-types.md`
- `docs/api/schemas/parent-objects.md`

## Deliverables

1. Drizzle schema in `packages/db/src/schema/*.ts` covering every table in `03-data-model.md`.
2. Migrations under `packages/db/src/migrations/` (forward + reverse).
3. Repositories in `packages/db/src/repositories/*.ts`:
   - `workspaces.ts` — CRUD + member lookup.
   - `users.ts`.
   - `pages.ts` — create, retrieve, update, archive, list by parent.
   - `databases.ts` — create, retrieve, update schema, list rows.
   - `blocks.ts` — create, retrieve, list children with cursor, append, update, archive; fractional position helpers.
   - `properties.ts` — get / set per-page property values; polymorphic envelope validation via shared schemas.
   - `comments.ts`, `discussions.ts`.
   - `permissions.ts` — `requirePermission(actor, resource, level)` with cache wiring.
   - `audit.ts` — append event.
4. `packages/db/src/fractional-index.ts` — pure functions: `generate(before, after)`, `between(a, b)`.
5. Seed in `tools/seed/` producing a workspace with: 1 user, 5 pages (one with cover/icon), 1 database with all 20 property types (each with a sample value), 1 sample page per block type.
6. `pnpm db:reset && pnpm db:migrate && pnpm db:seed` is idempotent.
7. Unit tests in `packages/db/tests/` covering every repo.
8. Integration test: round-trip a 6-deep nested block tree.
9. Benchmark: load 1000 children p99 < 80ms at repository layer; report saved to `benchmarks/reports/phase-01-*.json`.

## Todos

- [ ] 1.1 schema files for every table
- [ ] 1.2 fractional indexing utility + tests
- [ ] 1.3 polymorphic property value envelope validation
- [ ] 1.4 audit + soft-delete columns
- [ ] 1.5 migrations forward + reverse, idempotent
- [ ] 1.6 seed script
- [ ] 1.7 unit tests per repo
- [ ] 1.8 6-level nested round-trip integration test
- [ ] 1.9 1000-child benchmark

## Definition of Done

- Universal DoD gates pass.
- Schema can hold a sample value for every block type and every property type round-tripping through the shared Zod schemas.
- Benchmark report committed.

## Verification

```bash
pnpm db:reset
pnpm db:migrate
pnpm db:migrate:down  # reverse all
pnpm db:migrate       # again
pnpm db:seed
pnpm test packages/db
pnpm bench packages/db -- --report benchmarks/reports/phase-01-$(date +%Y%m%d).json
```

## Pitfalls

- Forgetting to denormalise `workspace_id` on `blocks` for permission checks → joins everywhere later.
- Adjacency-list ordering using integer position → O(n) re-sorts on insert. Use fractional indexing.
- `ON DELETE CASCADE` on `users` → catastrophic on a misclick. Use RESTRICT.