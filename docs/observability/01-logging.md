# Logging

## Tool

`pino` JSON logger, exposed from `packages/observability/src/logger.ts`.

## Levels

| Level | Use |
|-------|-----|
| `trace` | Reserved; rarely used |
| `debug` | Dev only; off in prod |
| `info` | Request received, request completed, job started, job completed |
| `warn` | Validation failures, rate-limit hits, retries |
| `error` | 5xx errors, job failure after retries, integrity violations |
| `fatal` | Process exit |

## Required fields

Every log line:

| Field | Type | Source |
|-------|------|--------|
| `time` | epoch ms | pino |
| `level` | string | pino |
| `msg` | string | caller |
| `service` | string | resource attr |
| `requestId` | string | middleware (`X-Request-Id` or generated) |
| `traceId` | string | active span |
| `spanId` | string | active span |
| `workspaceId` | string \| undefined | when known |
| `userId` | string \| undefined | when known |
| `routeId` | string \| undefined | for HTTP / WS |
| `code` | string \| undefined | for warn/error: machine-readable code matching API error codes |

## Forbidden fields

- Secrets, tokens, password hashes.
- Rich-text content of private resources.
- File contents.
- Stack traces in non-error levels.

## Per-route conventions

- On success: `info` with `msg="request completed"`, `status`, `duration_ms`.
- On 4xx: `warn` with `code`, `path`, `issue` summary; no stack.
- On 5xx: `error` with `error.message`, `error.stack`, `error.type`.

## Browser logging

- Console mirrors are dev only.
- Errors and warnings ship to `/v1/telemetry/events` and surface in Sentry.

## Volume

- Target: < 5 lines per request average.
- Anti-patterns: per-row DB result logging, hot-loop logs.

## Retention

- Prod: 30 days in Loki.
- Dev: stdout only.

## Test helpers

`assertLog('warn', { code: 'invalid_request' })` from `tests/observability/assert-log.ts`.