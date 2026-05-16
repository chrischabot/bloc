# Configuration

Every environment variable, its default, and what setting it incorrectly will do to you.

`.env.example` at the repo root is the canonical template — copy it to `.env` for local dev. In production load these via your secret manager, never check them in.

## Server

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | Set to `production` in prod. Enables stricter logging, disables the dev bootstrap token, turns on the rate limiter even without explicit config. |
| `API_PORT` | `3001` | Hono listens here. |
| `WEB_PORT` | `3000` | Next.js listens here. |
| `WORKER_PORT` | `3002` | Worker exposes a `/metrics` endpoint on this port. |

## Postgres

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `postgres://bloc:bloc@localhost:5432/bloc_dev` | Standard libpq URI. SSL is required in production — append `?sslmode=require`. |
| `DATABASE_POOL_MAX` | `20` | Per-process connection pool ceiling. Total connections = `pool_max × replicas`. Don't exceed Postgres `max_connections`. |

Postgres 16+ is required (the schema uses `uuid_v7()` from `pg_uuidv7` and JSON path features that landed in 16).

## Redis

| Variable | Default | Notes |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379` | Single-node URI. TLS via `rediss://`. |

If you front Redis with a cluster proxy (Elasticache cluster, KeyDB cluster) make sure cross-slot operations are tolerated — the rate-limiter uses Lua scripts, the pub/sub uses keyspace notifications.

## MeiliSearch

| Variable | Default | Notes |
|---|---|---|
| `MEILI_HOST` | `http://localhost:7700` | Base URL. |
| `MEILI_MASTER_KEY` | `dev-master-key` | **Must** be rotated in production. Generate ≥ 32 random bytes. |

## Object storage

S3-compatible (MinIO in dev, AWS S3 / R2 / Tigris / etc. in prod).

| Variable | Default | Notes |
|---|---|---|
| `S3_ENDPOINT` | `http://localhost:9000` | Drop this when using real AWS — the SDK auto-resolves from `S3_REGION`. |
| `S3_REGION` | `us-east-1` | |
| `S3_ACCESS_KEY` | `minioadmin` | |
| `S3_SECRET_KEY` | `minioadmin` | |
| `S3_BUCKET` | `bloc-files` | Must exist; auto-created on first boot in dev. |

Lifecycle policies: configure your bucket to expire `tmp/*` after 24 h and `exports/*` after 30 d. Bloc never deletes objects itself.

## OpenTelemetry

| Variable | Default | Notes |
|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4317` | gRPC endpoint of your collector. |
| `OTEL_SERVICE_NAME` | `bloc-api` | Set differently per process: `bloc-api`, `bloc-web`, `bloc-worker`. |
| `OTEL_LOG_LEVEL` | `info` | One of `error`/`warn`/`info`/`debug`. |

## Auth secrets

| Variable | Default | Notes |
|---|---|---|
| `SESSION_SECRET` | `dev-session-secret-change-me-in-production` | HMAC key for browser session cookies. Rotate on a schedule; rotation invalidates active sessions. |
| `TOKEN_V2_SECRET` | `dev-token-v2-secret-change-me` | Signs the internal v3 `token_v2` cookie used by `/api/v3`. |

Both should be ≥ 32 random bytes in production. Bloc refuses to start if `NODE_ENV=production` and these still match the development defaults.

## Email

| Variable | Default | Notes |
|---|---|---|
| `SMTP_HOST` | `localhost` | |
| `SMTP_PORT` | `1025` | Mailpit catches everything locally. Use 587 / 465 / 25 with your provider in prod. |
| `SMTP_FROM` | `noreply@bloc.local` | Set to a verified sender domain in prod. |

Optional in prod: `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` (`true` to force TLS).

## AI provider

| Variable | Default | Notes |
|---|---|---|
| `AI_PROVIDER` | `stub` | `stub`, `openai`, `anthropic`, or `local` (Ollama / vLLM compatible). |
| `OPENAI_API_KEY` | (unset) | Required if `AI_PROVIDER=openai`. |
| `ANTHROPIC_API_KEY` | (unset) | Required if `AI_PROVIDER=anthropic`. |

`stub` returns deterministic placeholders so you can run the SDK conformance tests without burning tokens.

## Rate limiting

| Variable | Default | Notes |
|---|---|---|
| `RATE_LIMIT_DISABLE` | `0` | Set to `1` to disable entirely. Only do this for benchmarking. |

Rate-limit bucket sizes are not env-driven; they're per-route in code. See [Reporting › Rate limiting](../reporting/05-rate-limiting.md).

## Sanity checks

- After editing `.env`, **restart all three processes**. `dotenv` only loads on boot.
- If `pnpm dev` exits immediately with "missing required env", look for the `Required:` line — that's the variable that's blank.
- The web app reads a subset (anything `NEXT_PUBLIC_*` plus build-time `API_URL`) at *build* time, not request time. After changing one of those, `pnpm --filter web build` again.
