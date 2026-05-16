# Phase 12 — Benchmarks & Performance Hardening

## Goal

Every API and every UI interaction meets the latency budgets.

## Read first

- `docs/testing/08-benchmarks.md`

## Deliverables

1. Run the full benchmark suite covering every endpoint and every property/block type combination.
2. Generate `benchmarks/reports/full-suite-<date>.json`.
3. Identify any endpoint or interaction exceeding budget; open issues; fix root cause.
4. Frontend INP < 200ms on: page open, keystroke, slash menu open, view switch, search submit.
5. Lighthouse perf ≥ 90 on `/` and on a 1000-block page (cold and warm).
6. Performance report published to `benchmarks/reports/`.

## Todos

- [ ] 12.1 Full suite executed
- [ ] 12.2 Reports committed
- [ ] 12.3 All budgets met or fixed
- [ ] 12.4 Frontend INP under budget
- [ ] 12.5 Lighthouse ≥ 90

## Definition of Done

- Universal DoD.
- All entries in the budget table in `docs/testing/08-benchmarks.md` pass.

## Pitfalls

- Cold vs warm differs hugely; measure both.
- DB connection pool sizing impacts p99 dramatically.
- Image transformation can dominate page-open time; pre-warm signed URLs and use HTTP/2 push or `<link rel="preload">`.