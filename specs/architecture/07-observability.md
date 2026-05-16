# Observability Architecture

Three pillars: traces, logs, metrics. All wired through `packages/observability`. The agent must propagate context across HTTP, WS, and background-job boundaries.

## Traces

- OpenTelemetry SDK with OTLP/gRPC export to a collector running on `localhost:4317` in dev, OTEL_EXPORTER_OTLP_ENDPOINT in prod.
- One root span per inbound request (HTTP route handler) or per WS message handler or per job invocation.
- Span attributes:
  - `service.name` = `bloc-api`, `notion-web`, `notion-worker`
  - `service.version` = git SHA
  - `workspace.id`, `user.id`, `integration.id` (whichever applies)
  - `http.method`, `http.route`, `http.status_code`
  - `notion.object_type` (page/database/block), `notion.object_id`
  - `db.statement` (parameterised), `db.system=postgresql`
  - `error=true` on 5xx with `exception.message`, `exception.stacktrace`
- Sampling: head-based 100% in dev/staging; tail-based in prod with 100% on errors and 10% on success.

## Logs

- pino JSON, line-delimited.
- Fields: `level`, `time`, `msg`, `requestId`, `traceId`, `spanId`, `workspaceId`, `userId`, `routeId`, ad-hoc structured context.
- Levels:
  - `trace` (rarely used)
  - `debug` (development only; off in prod)
  - `info` (normal flow: request received, request completed, job started, job completed)
  - `warn` (rate limit hit, validation failed but expected, retry attempted)
  - `error` (5xx, job failed after retries, integrity violation)
  - `fatal` (process exit)
- Every error path emits an `error` log line with full context. **Never** log secrets, tokens, or rich-text content of private pages.

## Metrics

Prometheus-scrape endpoint at `/metrics`.

| Metric | Type | Labels |
|--------|------|--------|
| `http_requests_total` | counter | method, route, status |
| `http_request_duration_seconds` | histogram | method, route |
| `ws_connections_active` | gauge | |
| `ws_messages_total` | counter | direction (in/out), kind |
| `job_runs_total` | counter | job, status |
| `job_duration_seconds` | histogram | job |
| `db_query_duration_seconds` | histogram | repository, operation |
| `cache_hits_total` / `cache_misses_total` | counter | key_prefix |
| `rate_limit_exceeded_total` | counter | identity_type |
| `search_index_lag_seconds` | gauge | |

Histogram buckets default to `[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]` seconds.

## Frontend telemetry

- Web Vitals (LCP, INP, CLS) reported to API at `/v1/telemetry/vitals`.
- User actions emit client events: `page.opened`, `block.created`, `slash.opened`, `view.switched`, `search.executed`, etc. — to `/v1/telemetry/events`.
- All client events carry the active trace context (W3C `traceparent`), so user actions are linkable to server traces.

## Dashboards

`docs/observability/03-dashboards.md` describes the required Grafana dashboards (Latency Overview, Per-Endpoint Latency, Realtime, Database Engine, Search, Errors, Saturation). The repo ships dashboard JSON in `tools/grafana/`.

## Mandatory assertions in tests

Every code path that ships under a phase must include — in its integration / e2e test — a check that:

1. The expected span name was created with the expected attributes.
2. For error paths: a log at `warn` or `error` was emitted with the expected `code` field.
3. For UI actions: the expected client event was sent (Playwright intercepts `/v1/telemetry/events`).

Helpers live in `tests/observability/`. See `docs/testing/10-observability-tests.md`.