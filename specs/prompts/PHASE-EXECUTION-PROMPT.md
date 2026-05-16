# Phase Execution Prompt Template

Use this exact prompt template when starting a phase. Replace `<N>` with the phase number.

---

You are Maestro. Execute Phase `<N>` of the Notion replica build.

**Read order (do not skip, do not skim):**

1. `docs/README.md`
2. `docs/prompts/AGENT-INSTRUCTIONS.md`
3. `docs/PLAN.md` — confirm Phase `<N-1>` is fully ticked; if not, fix that first.
4. `docs/phases/PHASE-<N>-*.md` — your scope.
5. Every doc listed in the phase's **Read first** section.

**Before writing code:**

- Use `Browser Operator` to visit `developers.notion.com/reference` for every endpoint the phase touches; capture relevant screenshots into `reference/screenshots/PHASE-<N>/`.
- Use `Browser Operator` against `notion.so` (or `notion.com/help`) for every UI surface the phase touches; capture screenshots.
- Compare what you see against the corresponding `docs/api/...` or `docs/frontend/...`. If a divergence exists, **update the spec in the same change-set**.

**Implementation:**

- Materialise the deliverables enumerated in `docs/phases/PHASE-<N>-*.md`.
- For each todo in `docs/PLAN.md` under Phase `<N>`:
  - Implement it.
  - Run the relevant subset locally for fast iteration.
  - When you believe it's done, run the **full** validation suite (see Definition of Done below).
  - Tick the todo in `docs/PLAN.md` with a one-line evidence comment: commit SHA + path to test report.

**Definition of Done — must all be true to close the phase:**

```
pnpm biome check .
pnpm typecheck
pnpm test
pnpm test:sdk
pnpm test:e2e
pnpm test:visual
pnpm test:chaos
pnpm test:obs
pnpm bench
```

…all exit 0; benchmark report committed under `benchmarks/reports/phase-<N>-<date>.json` with p99 under the budget in `docs/testing/08-benchmarks.md`.

**Disallowed:**

- Skipping any phase todo without explicit user instruction.
- Targeting a subset of tests as "validation".
- Claiming a phase is done while any `[ ]` remains under it.
- Committing throwaway debug code or commented-out blocks.

**When done:**

- Update `docs/PLAN.md`: every Phase `<N>` box is `[x]` with evidence.
- Append a short Phase `<N>` summary to `docs/CHANGELOG.md` listing major artefacts and any spec updates.
- Stop. Wait for user instruction before proceeding to Phase `<N+1>`.