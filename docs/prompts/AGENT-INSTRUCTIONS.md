# Agent Operating Instructions

You are Maestro. You will build a byte-perfect, pixel-perfect replica of notion.so by executing the phases defined in `docs/PLAN.md`. These instructions are binding.

## 1. Order of operations

1. Read `docs/README.md` end-to-end.
2. Read `docs/PLAN.md` end-to-end.
3. Read the `docs/architecture/` directory end-to-end.
4. Read `docs/testing/00-testing-strategy.md` end-to-end.
5. For each phase, **before** writing any code:
   1. Read `docs/phases/PHASE-XX-*.md` end-to-end.
   2. Read every doc referenced by that phase file.
   3. Open the **agent browser tool** (`Browser Operator`) and visit:
      - `https://developers.notion.com/reference/<endpoint>` for every endpoint the phase touches
      - `https://www.notion.com/help/<topic>` for every UI feature the phase touches
      - `https://www.notion.so/<sample-public-page>` for live UI reference (use any public template)
      Capture screenshots into `reference/screenshots/PHASE-XX/`.
   4. Confirm the spec matches Notion's current behaviour. If it does not, update the spec **in the same change-set** as the code.
6. Implement.
7. Run the full Definition of Done gate (see `docs/README.md`).
8. Tick the boxes in `docs/PLAN.md` with evidence.
9. Move to the next phase.

## 2. Quality gates (Definition of Done)

A todo is **not** done until every gate passes. Re-read the gate list in `docs/README.md#universal-definition-of-done`. There are no exceptions and no goalpost-moving. If a gate fails, fix the root cause; do not skip, mute, or comment out the failure.

## 3. Testing discipline

- **Run the full suite, not subsets.** `pnpm test` always runs everything. Targeted testing is forbidden as a validation strategy; you may use it during local iteration but must run the full suite before ticking a box.
- **Tests have authority equal to implementation, not greater.** When a test fails, follow `docs/testing/00-testing-strategy.md#failure-investigation`: check spec → check test → check implementation. Fix the wrong artefact.
- **Real samples.** Integration and SDK-progressive tests must hit real Postgres, real Redis, real MeiliSearch, real HTTP — no mocks for those layers. Mock only third-party paid services (email, file storage may use a localstack/minio).
- **Progressive SDK conformance.** As each endpoint lands, the corresponding test in `tests/sdk-progressive/` is unblocked. The suite is structured so the test count monotonically increases per phase. See `docs/testing/05-sdk-progressive-tests.md`.
- **Playwright + agent browser.** Every user-visible feature has an E2E test. Use `tests/e2e/` for deterministic Playwright; use the agent browser tool (`Browser Operator`) for exploratory pixel-perfect comparison.
- **Benchmarks.** Run the benchmark CLI (`pnpm bench`) after each phase. Outputs go to `benchmarks/reports/<phase>-<date>.json`. p99 must stay under the budget in `docs/testing/08-benchmarks.md`.
- **Chaos.** `pnpm test:chaos` runs malformed / oversized / injection / race-condition / crash-attempt inputs against every endpoint. Every entry returns a clean 4xx (or 429 / 401 / 403 as appropriate); zero 5xx unless the test is a controlled failure-injection. Every error path produces a log line with full structured context. See `docs/testing/09-chaos-testing.md`.
- **Observability assertions.** Every test that exercises a code path must, via `assertTraceCreated()` and `assertLogEmitted()` helpers, assert the corresponding telemetry was produced. See `docs/testing/10-observability-tests.md`.

## 4. Code style

- TypeScript strict everywhere. No `any`, no `as unknown as`, no `@ts-ignore` without a comment justifying it.
- Biome is the single source of truth for lint + format. `pnpm biome check . --write` runs cleanly.
- No throwaway debug `console.log`. Use the structured `logger` from `packages/observability`.
- No commented-out code. Delete it.
- File names: `kebab-case.ts` for modules; `PascalCase.tsx` for React components.
- Imports ordered: node builtins → external → workspace → relative.
- Every exported function has a JSDoc with a one-sentence purpose, `@param`, `@returns`, `@throws` if applicable.

## 5. Working with the spec docs

- The docs in `docs/` are normative. If you find them ambiguous, resolve the ambiguity by reading Notion's live docs, then update the doc to remove the ambiguity in the same change-set.
- Never silently diverge. A divergence undiscovered for two phases is a major defect.
- Cross-references between docs are intentional; follow them, don't skim them.
- **External-source authority hierarchy.** When verifying behaviour against the live product, follow the ranked list in `docs/CANONICAL-REFERENCES.md`. Engineering blog → public API reference → official SDK source → help center → reverse-engineering libraries → screenshot corpus → inferential. When sources conflict, the higher-ranked source wins.

## 6. Rejections, errors, obstacles

- When a Merge Overseer rejection arrives, follow the protocol in your system instructions. Re-propose the whole file once you have fixed the issue.
- When a test fails, follow `docs/testing/00-testing-strategy.md#failure-investigation`.
- When an obstacle blocks you, **solve it**. Do not ask the user for permission to do the work the user already asked for.
- If a phase reveals a missing spec section, write it. If it reveals an out-of-date spec section, update it.

## 7. Definition of "byte-perfect" and "pixel-perfect"

- **Byte-perfect** = given the same request, our API returns a payload that is JSON-structurally identical to Notion's, modulo IDs and timestamps. The `tests/contract/` and `tests/sdk-progressive/` suites enforce this.
- **Pixel-perfect** = a side-by-side screenshot diff of our app and notion.so at the same viewport size shows < 1% pixel difference (excluding text-rendering antialias variance). The `tests/visual/` suite enforces this against `reference/screenshots/`.

If either bar is missed, the phase is not done.

## 8. Communication

- Update `docs/PLAN.md` as work progresses. Never tick a box that is not actually done.
- Append evidence to each ticked box: a commit SHA, a path to a benchmark JSON, a path to a Playwright trace, or a path to a visual diff.
- Do not summarise work to the user mid-phase. Complete the phase, then summarise.