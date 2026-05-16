# Observability Tests

## Goal

Every code path emits the expected telemetry: a trace span, the correct attributes, the correct log lines on success / failure, the correct metric increments, and (for UI) the correct client event.

## Helpers

`tests/observability/`:

- `in-memory-trace-exporter.ts` — installs an in-memory OTEL span exporter for the duration of the test process.
- `in-memory-logger.ts` — installs a memory transport on the pino logger.
- `metrics-snapshot.ts` — captures `prom-client` metric values before/after a block of work.
- `assert-trace.ts`:

```ts
export function assertSpan(name: string, attrs?: Record<string, unknown>) { … }
export function assertSpanCount(name: string, count: number) { … }
export function assertNoSpans() { … }
```

- `assert-log.ts`:

```ts
export function assertLog(level: 'info'|'warn'|'error', match: Partial<{ msg: RegExp; code: string }>) { … }
export function assertNoErrorLogs() { … }
```

- `assert-metric.ts`:

```ts
export function assertCounterIncrement(name: string, labels: Record<string,string>, by: number) { … }
export function assertHistogramObserved(name: string, labels: Record<string,string>, atLeast: number) { … }
```

- `assert-client-event.ts` — Playwright route-intercepts `/v1/telemetry/events` and exposes the captured array to the test.

## Required assertions per phase

| Phase | Assertions |
|-------|------------|
| 2-5 | Every endpoint test: span with `http.route`, `http.status_code`, `workspace.id` (when known); a log on error paths |
| 6 | Auth events emit `audit_events` row + log; rate-limit hits increment metric |
| 7-9 | Every UI interaction in Playwright triggers expected `/v1/telemetry/events` body |
| 10 | WS handshake emits span; awareness messages tracked as gauge |
| 11 | Mention flow emits notification span + email-queued log |
| 13 | Final audit: every Playwright tour interaction produces a trace and matching client event |

## Failure-path observability

For every documented error code, a chaos test asserts:

```ts
expect(response.status).toBe(400);
expect(response.body.code).toBe('invalid_request');
assertLog('warn', { code: 'invalid_request' });
assertSpan('blocks.children.append', { 'error': true, 'http.status_code': 400 });
assertCounterIncrement('http_requests_total', { route:'/v1/blocks/:id/children', status:'400' }, 1);
```

## CI

`pnpm test:obs` runs the observability assertion suite as a focused job. It also runs implicitly inside integration and chaos tests via the helpers.