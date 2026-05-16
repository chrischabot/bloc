# Logging

All Bloc processes log JSON to stdout. Ship it to your aggregator with whatever sidecar you use (Fluent Bit, Vector, Promtail).

## Format

Each line:

```json
{
  "level":    "info" | "warn" | "error" | "debug",
  "msg":      "request completed",
  "ts":       "2025-05-16T22:00:00.123Z",
  "service":  "bloc-api",
  "requestId": "01J5QP…",
  "method":   "POST",
  "route":    "/v1/pages/:page_id",
  "status":   200,
  "durationMs": 42,
  "userId":   "uuid" | null,
  "workspaceId": "uuid" | null
}
```

The `requestId` field is the join key against traces.

## Levels

| Level | When |
|---|---|
| `debug` | Off by default; enable per-deploy with `LOG_LEVEL=debug` |
| `info` | Every request (success and 4xx), startup, shutdown |
| `warn` | Recoverable errors: webhook retry exhausted, rate-limit exceeded, slow query |
| `error` | 5xx, unhandled exceptions, dependency outages |

## Redaction

Bloc redacts these fields **before** the log line is written:

- `Authorization` header (replaced with `Bearer ***`)
- `body.password` (in auth-flow logs)
- `body.refresh_token`, `body.access_token`
- Cookie values

If you wrap requests with your own middleware, audit your code — don't re-introduce raw headers.

## Pretty printing in dev

Set `LOG_PRETTY=1` to get `pino-pretty` output:

```
[22:00:00.123] INFO  bloc-api  request completed  requestId=01J5… route=/v1/pages/:id status=200 durationMs=42
```

Production must use JSON — pretty-printing slows logging by an order of magnitude.

## Sampling

Bloc doesn't sample logs. Every request emits one info line. If your aggregator costs scale with line count, sample at the agent side, not at Bloc.

## Searching

Common queries (LogQL syntax):

```
# All 5xx in the last hour
{service="bloc-api"} | json | level="error"

# Slow requests
{service="bloc-api"} | json | durationMs > 1000

# A specific request by id
{service="bloc-api"} | json | requestId="01J5QP..."

# All failures from a webhook
{service="bloc-api"} | json | route=~"/v1/webhooks/.*" | level=~"warn|error"
```
