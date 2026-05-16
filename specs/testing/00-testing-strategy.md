# Testing Strategy

## Pyramid

```
                          ┌─────────────┐
                          │  Pixel /    │   13.x — visual diff < 1%
                          │  Visual     │
                       ┌──┴─────────────┴──┐
                       │  E2E (Playwright) │  ~150 user-journey tests
                    ┌──┴───────────────────┴──┐
                    │  Chaos                  │  ~300 adversarial inputs
                 ┌──┴────────────────────────┴──┐
                 │  SDK-progressive             │  monotonic, one per SDK fn
              ┌──┴──────────────────────────────┴──┐
              │  Contract                          │  one per endpoint x payload
           ┌──┴────────────────────────────────────┴──┐
           │  Integration                              │  real DB / Redis / MeiliSearch
        ┌──┴──────────────────────────────────────────┴──┐
        │  Unit                                            │  fast, isolated, ≥ 90% coverage on touched code
        └──────────────────────────────────────────────────┘
```

The bottom is broad and fast. As you move up, tests get fewer but more end-to-end. Every layer is non-negotiable.

## Layers

### Unit

- Scope: one module, no IO.
- Tool: Vitest.
- Coverage gate: 90% line coverage on **touched** files in a PR (not project-wide; project-wide tracked but not gated).
- Mocking: only the immediate boundary of the unit (e.g. mock the Drizzle client in a service test). Never mock multiple layers.

### Integration

- Scope: a thin slice through several layers — typically route handler + repo + DB.
- Real Postgres, real Redis, real MeiliSearch, real HTTP server.
- Each test gets a fresh schema (Vitest `globalSetup` truncates tables in `beforeEach`).
- Outbound third-party services (email, S3, OAuth providers) are stubbed via `undici.MockAgent` or a localstack/minio equivalent.

### Contract

- Scope: per-endpoint per-payload assertion that the response matches the documented JSON shape exactly.
- Tool: Vitest + a JSON-Schema validator generated from the Zod schemas in `packages/shared`.
- Includes happy paths and the documented error codes.

### SDK-progressive

- Scope: every public SDK function under `packages/sdk`.
- Tests are gated by phase: as each endpoint lands, the corresponding SDK test is unblocked.
- The same call, with the same input, exercised through both **our** SDK and the **official** `@notionhq/client` against a recorded fixture, must produce equivalent responses (modulo IDs/timestamps).
- See `docs/testing/05-sdk-progressive-tests.md`.

### E2E (Playwright)

- Scope: user journeys executed in a real browser against a live backend.
- Phase 0 ships a single "smoke" journey; every subsequent phase adds journeys.
- Browsers cached in CI; tests run in parallel shards.

### Visual regression

- Scope: per component / per surface screenshot vs `reference/screenshots/`.
- Tool: Playwright + `pixelmatch`. Anti-alias noise ignored via a 1% threshold.

### Benchmarks

- Scope: per endpoint and per UI interaction.
- Tool: `tools/benchmark/` CLI using `autocannon` (HTTP) and `tinybench` (in-process).
- Produces `benchmarks/reports/<phase>-<date>.json` with `p50`, `p90`, `p99`, `max`.
- Budget table in `docs/testing/08-benchmarks.md`.

### Chaos

- Scope: malformed / oversized / adversarial inputs and crash attempts.
- Tool: custom harness in `tests/chaos/` using `fast-check` for property-based fuzzing and a deterministic adversarial corpus.
- Every endpoint, every property type, every block type covered.

### Observability assertions

- Scope: every test that exercises a code path asserts that the expected telemetry is produced.
- Helpers in `tests/observability/`.
- See `docs/testing/10-observability-tests.md`.

## Failure investigation protocol

When a test fails, follow this order strictly:

1. **Read the failure end to end.** Stack trace, last log line, span attributes, the test code.
2. **Determine source of truth.**
   - If the failure relates to API shape → `docs/api/`.
   - If the failure relates to UI → `docs/frontend/`.
   - If the failure relates to data model → `docs/architecture/03-data-model.md`.
3. **Triage which artefact is wrong:**
   - Test? — does the test encode the spec correctly?
   - Implementation? — does the code implement the spec correctly?
   - Spec? — is the spec itself ambiguous or out of date?
4. **Fix the right artefact, and only that one.** If the spec is wrong, update it in the same change-set as the code.
5. **Re-run the full suite.** Not just the failing test.

Never silence, skip, or mute tests. Never `if (false)` to make them pass. If a test is genuinely environmental and flaky, fix the source of flakiness; if no time, mark `test.fixme` with a tracking issue link — but this must be exceptional.

## Continuous gates

Every PR runs:

```
pnpm biome check .
pnpm typecheck
pnpm test                  # unit + integration + contract
pnpm test:sdk              # SDK-progressive (matrix grows with phases)
pnpm test:e2e              # Playwright
pnpm test:visual           # visual regression
pnpm bench -- --smoke      # quick benchmark sanity
pnpm test:chaos -- --smoke # quick chaos sanity
```

Phase boundaries additionally run:

```
pnpm bench                 # full benchmark
pnpm test:chaos            # full chaos
pnpm test:obs              # observability assertions
```

## Determinism

- Tests must be deterministic. No `Date.now()` in tests — use `vi.useFakeTimers()` or a `Clock` interface.
- No flakey ordering — every async assertion uses Testing Library's auto-retry or Playwright's `expect()` with timeout.
- No network access in unit tests; integration tests must run against the docker-compose stack started by `pnpm test:up`.