# Tracing

## Stack

- **SDK**: `@opentelemetry/sdk-node` on the server, `@opentelemetry/sdk-web` on the browser.
- **Instrumentations**: HTTP server, HTTP client (undici/fetch), Postgres (`@opentelemetry/instrumentation-pg`), Redis, IORedis, BullMQ. Browser: fetch + user interaction + document load + long task.
- **Exporter**: OTLP/gRPC to the collector on `OTEL_EXPORTER_OTLP_ENDPOINT` (defaults to `http://localhost:4317` in dev).
- **Collector**: `otel/opentelemetry-collector-contrib` in `docker-compose.yml`; routes spans to Tempo (or Jaeger).

## Resource attributes

Every emitter sets:

```
service.name        = bloc-api | notion-web | notion-worker
service.version     = git SHA short
service.instance.id = host name
deployment.environment = dev | staging | prod
```

## Span naming convention

`<domain>.<operation>` — examples:

- `http.GET /v1/blocks/:id` (auto from instrumentation)
- `blocks.children.append` (manual)
- `db.blocks.list_children`
- `query_engine.compile`
- `ws.message.update`
- `worker.index-page`
- `web.interaction.slash_menu_open`

Use `tracer.startActiveSpan(name, { attributes }, fn)` for manual spans.

## Required attributes

| Context | Attributes |
|--------|------------|
| Any inbound request | `http.method`, `http.route`, `http.status_code`, `user_agent`, `client.address` |
| Authenticated | `user.id`, `workspace.id`, `integration.id` (whichever) |
| Resource-touching | `notion.object_type` (page/database/block), `notion.object_id` |
| DB ops | `db.system`, `db.statement` (parameterised), `db.rows_affected` |
| Error | `error=true`, `exception.type`, `exception.message`, `exception.stacktrace` |

## Context propagation

- W3C `traceparent` + `tracestate` headers on every outbound request.
- WS: send `traceparent` as the first message after connect; gateway propagates onto each per-message span.
- BullMQ: pack trace context in job data; worker unpacks on `process`.
- Browser → API: `traceparent` header set by the SDK fetch wrapper. The browser root span ID is the parent for the server span.

## Sampling

- Dev / staging: head-based 100%.
- Prod: tail-based via collector; 100% sampling on errors and slow requests (> 1s), 10% on success.

## Privacy

- Never set `db.statement` with embedded user content; use `db.statement` for the parameterised SQL only and bind values are excluded.
- Never set rich-text content as an attribute; attach `notion.object_id` + content hash if needed.
- Never set token or session id as an attribute; use hashed identity.

## Validation

- The `assertSpan()` helper in `tests/observability/` runs against an in-memory exporter.
- A `tools/trace-explorer/` script tails the local collector and prints the most recent traces for manual verification.