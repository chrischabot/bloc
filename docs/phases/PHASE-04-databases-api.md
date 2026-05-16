# Phase 4 — Databases API

## Goal

REST surface for databases per `docs/api/endpoints/databases.md`, including the full query engine.

## Read first

- `docs/api/endpoints/databases.md`
- `docs/api/schemas/property-types.md`
- `docs/api/schemas/filters.md`
- `docs/api/schemas/sorts.md`
- `docs/api/schemas/formulas.md`

## Deliverables

1. Route handlers in `apps/api/src/routes/databases.ts`.
2. Query engine in `packages/db/src/query-engine.ts`:
   - Filter compiler: filter AST → SQL with parameterised binding for SQL-compilable nodes; deferred post-filter eval for formula/rollup nodes (clearly marked).
   - Sort compiler.
   - Pagination with stable tiebreaker.
3. Formula compiler + evaluator (`packages/db/src/formula/parser.ts`, `eval.ts`).
4. Rollup evaluator (`packages/db/src/rollup.ts`) with all functions in `docs/api/schemas/property-types.md#rollup`.
5. Dual-property relation bidirectional sync.
6. SDK in `packages/sdk/src/databases.ts`.
7. Contract tests covering every operator on every property type.
8. SDK-progressive tests.
9. Chaos: nested filter depth > 2, unknown operator, operand type mismatch, oversized result set, malformed cursor → all clean 400.
10. Observability spans per query include compiled SQL (parameterised), row count, eval-side count for formula/rollup hybrid.
11. Benchmark: 10k-row DB × 3-clause compound filter p99 < 250ms.

## Todos

- [ ] 4.1 POST create
- [ ] 4.2 GET retrieve
- [ ] 4.3 PATCH update
- [ ] 4.4 POST query
- [ ] 4.5 All 20 property types
- [ ] 4.6 All filter operators per type
- [ ] 4.7 Compound and/or nesting ≤ 2
- [ ] 4.8 Sort by property + timestamp
- [ ] 4.9 Formula engine
- [ ] 4.10 Rollup engine
- [ ] 4.11 Bidirectional relation sync
- [ ] 4.12 Contract / SDK / chaos / obs / benchmark green

## Definition of Done

- Universal DoD.
- 100 golden-fixture filter expressions match expected row sets exactly.
- Formula eval matches Notion's documented behaviour on the 200-expression golden suite.

## Pitfalls

- Polymorphic property value comparison in SQL needs careful jsonb path indexing.
- Date relative ranges (`this_week`, `past_month`) depend on server tz; tests must seed against a frozen clock.
- Relation `has_more` truncation requires the page-properties endpoint to be fully implemented.