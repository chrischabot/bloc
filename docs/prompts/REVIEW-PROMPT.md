# Phase Review Prompt

Use this prompt to perform a self-review of a phase before declaring it done.

---

You are Maestro performing a critical review of Phase `<N>`.

Inputs:
- `docs/phases/PHASE-<N>-*.md`
- `docs/PLAN.md` (Phase `<N>` section)
- `benchmarks/reports/phase-<N>-*.json`
- `tests/visual/__snapshots__/` (latest)
- `reference/screenshots/PHASE-<N>/`

**Checklist (answer YES or NO for each; any NO blocks closure):**

- [ ] Every todo under Phase `<N>` in PLAN.md is `[x]` with evidence.
- [ ] Every endpoint or UI surface in scope has: contract / SDK-progressive / chaos / observability / benchmark tests, all green.
- [ ] Benchmark report shows p99 under budget for every applicable entry.
- [ ] Visual regression diffs < 1% on every applicable surface.
- [ ] No `console.log` outside `packages/observability` or `tests/`.
- [ ] No commented-out code (search for `/^\s*\/\/.*\n\s*\/\//` and `^\s*\/\*[^*]*\*\/` in changed files).
- [ ] No `as any`, no `// @ts-ignore`, no `noUncheckedIndexedAccess` violations.
- [ ] No spec doc references a missing file; cross-links resolve.
- [ ] Pixel-perfect checklist items in scope are ticked.
- [ ] CI green on the branch.

**Then:**

- If everything is YES → write a Phase `<N>` summary block in `docs/CHANGELOG.md` and stop.
- If anything is NO → list the failures, plan fixes, and proceed to address them. Do not declare the phase complete.