# `tools/benchmark` CLI

The CLI is the single source of truth for benchmark numbers in `benchmarks/reports/`.

## Invocation

```
pnpm bench [--scenario <name>] [--iters <n>] [--concurrency <n>] [--warmup <n>] \
           [--report <path>] [--smoke] [--budgets <path>]
```

Examples:

- `pnpm bench`                          run every scenario, write a stamped report
- `pnpm bench --smoke`                  ~5s sanity run for every scenario
- `pnpm bench --scenario blocks.append.100 --iters 5000`
- `pnpm bench --budgets docs/testing/08-benchmarks.md` enforce budgets, exit non-zero on breach

## Scenarios

`tools/benchmark/scenarios/` contains one TS file per scenario:

```ts
export const scenario: Scenario = {
  name: 'blocks.append.100',
  setup: async (env) => { /* seed workspace + page */ },
  run:   async (env) => { /* one iteration of the work */ },
  teardown: async (env) => {},
  budget_p99_ms: 250,
};
```

Auto-registered via filesystem scan.

## Output

Per-scenario JSON:

```jsonc
{
  "label": "blocks.append.100",
  "ts": "2026-05-15T19:30:00Z",
  "iters": 5000,
  "concurrency": 10,
  "p50_ms": 38,
  "p90_ms": 71,
  "p99_ms": 132,
  "max_ms": 410,
  "errors": 0,
  "budget_p99_ms": 250,
  "passed": true,
  "host": { "cpu": "...", "ram_gb": 36, "node": "v22.10.0" },
  "ref": "git:<sha>"
}
```

Aggregate file: `benchmarks/reports/full-suite-<date>.json` with the array of per-scenario reports plus a summary block.

## Budget enforcement

With `--budgets`, the CLI parses `docs/testing/08-benchmarks.md` for the budget table (a small markdown table parser lives in `tools/benchmark/budget-parser.ts`) and exits non-zero if any p99 exceeds budget × 1.1.

## Histogram fidelity

- Uses `tinybench` for in-process; `autocannon`'s built-in histogram for HTTP.
- Excludes the first 200 iterations (warm-up).
- All measurements in seconds → ms conversion at report time.

## CI

- Phase 12 step runs `pnpm bench --budgets docs/testing/08-benchmarks.md`.
- PR step runs `pnpm bench --smoke` and uploads the smoke report as an artifact.

## Comparison

`tools/benchmark/compare.ts <a.json> <b.json>` prints a delta table; > 20% regression is highlighted.