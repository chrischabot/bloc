# Benchmarks

## Tool

`tools/benchmark/` CLI.

- HTTP benchmarks: `autocannon` against the local API on a warmed-up instance.
- In-process benchmarks: `tinybench` (statistically rigorous).
- Frontend benchmarks: Playwright with `performance.mark/measure` and the Web Performance API.

## Report shape

JSON written to `benchmarks/reports/<phase-or-target>-<date>.json`:

```jsonc
{
  "label": "blocks.children.append-100",
  "ts": "2026-05-15T19:15:00Z",
  "iters": 5000,
  "p50_ms": 42,
  "p90_ms": 78,
  "p99_ms": 132,
  "max_ms": 410,
  "errors": 0,
  "host": { "cpu": "M3 Pro", "ram_gb": 36 },
  "ref": "git:<sha>"
}
```

## Methodology

- Warm-up: 200 iterations discarded.
- Concurrency: documented per scenario; for API benchmarks default 10.
- Connections: persistent (HTTP keep-alive).
- Each scenario uses a seeded DB and isolated workspace.
- Cold and warm variants for page-open.

## Budget table

### API budgets (warm, p99 unless stated)

| Operation | Budget |
|-----------|--------|
| `GET /blocks/:id` | 80 ms |
| `GET /blocks/:id/children` (100 children) | 100 ms |
| `PATCH /blocks/:id/children` (append 1) | 100 ms |
| `PATCH /blocks/:id/children` (append 10) | 200 ms |
| `PATCH /blocks/:id/children` (append 100) | 250 ms |
| `PATCH /blocks/:id` (update) | 100 ms |
| `DELETE /blocks/:id` | 100 ms |
| `POST /pages` (no children) | 150 ms |
| `POST /pages` (with 100 children) | 350 ms |
| `GET /pages/:id` | 150 ms |
| `PATCH /pages/:id` | 150 ms |
| `GET /pages/:id/properties/:prop` (paginated) | 150 ms |
| `POST /databases` | 200 ms |
| `GET /databases/:id` | 100 ms |
| `PATCH /databases/:id` | 200 ms |
| `POST /databases/:id/query` (1k rows, no filter) | 150 ms |
| `POST /databases/:id/query` (10k rows, 3-clause filter) | 250 ms |
| `POST /databases/:id/query` (10k rows, formula filter) | 600 ms |
| `POST /search` (empty query, top 10) | 100 ms |
| `POST /search` (typo, top 10, 100k docs) | 200 ms |
| `POST /comments` | 100 ms |
| `GET /comments?block_id=...` | 80 ms |
| `GET /users/me` | 30 ms |
| `GET /users` | 80 ms |
| `POST /auth/email/start` | 80 ms |

### WS budgets

| Operation | Budget |
|-----------|--------|
| Connect (auth + initial sync, 100-block page) | 250 ms p99 |
| Keystroke ack (local) | 16 ms p99 |
| Keystroke ack (remote echo) | 80 ms p99 |
| Cursor awareness propagate | 60 ms p99 |

### Frontend INP budgets (p95)

| Interaction | Budget |
|-------------|--------|
| Page navigation in sidebar | 200 ms |
| Open slash menu | 100 ms |
| Toggle bold on selection | 100 ms |
| Switch database view | 200 ms |
| Open share dialog | 150 ms |
| Open settings | 200 ms |

### Page load

| Scenario | Budget |
|----------|--------|
| `/` cold LCP | 1500 ms |
| `/` warm LCP | 400 ms |
| 1000-block page cold LCP | 1800 ms |
| 1000-block page warm LCP | 500 ms |

## CI

- Phase 12 runs the full suite and fails on any p99 > budget × 1.1 (10% tolerance).
- A trend report compares to last good run; regressions > 20% flagged for review.