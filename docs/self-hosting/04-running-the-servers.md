# Running the servers

Bloc is three processes — `apps/api`, `apps/web`, `apps/worker` — plus the data-tier services (Postgres, Redis, MeiliSearch, S3, SMTP, OTel collector).

## In dev

`pnpm dev` runs all three under [turbo](https://turbo.build) with parallel output:

```bash
pnpm dev
# api:   listening on :3001
# web:   ready on :3000
# worker: heartbeat OK
```

Hot reload is on for all three. The API uses `tsx watch`, the web uses Next's dev server, the worker uses `tsx watch`.

To run one in isolation:

```bash
pnpm --filter api dev
pnpm --filter web dev
pnpm --filter worker dev
```

## Building for production

```bash
pnpm build
```

This produces:

- `apps/api/dist/index.js` — bundled API server (run with `node apps/api/dist/index.js`).
- `apps/web/.next/` — Next.js standalone build (run with `node apps/web/.next/standalone/server.js`).
- `apps/worker/dist/index.js` — worker (run with `node apps/worker/dist/index.js`).

Each binary respects the env vars from [Configuration](./02-configuration.md).

## What each process needs

### `apps/api`

| Dep | Required | Why |
|---|---|---|
| Postgres | yes | Authoritative state |
| Redis | yes | Rate limit + pub/sub |
| MeiliSearch | yes | `/v1/search` calls into it |
| S3 | yes | File uploads served from signed URLs |
| SMTP | optional | Outbound email (invites, OAuth confirm); absence is logged, not fatal |
| OTel collector | optional | Traces; if absent, the SDK silently drops |

Process model: stateless. Scale horizontally behind a load balancer with sticky sessions for the WebSocket path (`/v1/realtime/ws`); REST routes don't need stickiness.

### `apps/web`

| Dep | Required |
|---|---|
| API | yes — set `NEXT_PUBLIC_API_URL` at build time |
| (everything else proxied via the API) | — |

Stateless. Scale horizontally. CDN-cache the static assets under `/.next/static/*`.

### `apps/worker`

| Dep | Required |
|---|---|
| Postgres | yes — uses `LISTEN/NOTIFY` and batch reads |
| Redis | yes — locks + queue |
| MeiliSearch | yes — reindex jobs write here |
| S3 | yes — export jobs write here |
| SMTP | yes — digest emails |

Process model: leader-election via Redis. Multiple workers can run; one elects as the scheduler, the rest are workers. Safe to scale to N — the scheduler load is small.

## Health & readiness

| Endpoint | Purpose |
|---|---|
| `GET /health` (API) | Liveness — returns 200 if the process is up |
| `GET /ready` (API) | Readiness — returns 200 if Postgres + Redis are reachable |
| `GET /metrics` (API, worker) | Prometheus exposition |

Wire `/ready` to your orchestrator's readiness probe — that's what gates traffic into a freshly started replica.

## Logging

All three processes log JSON to stdout. Each line has `timestamp`, `level`, `msg`, plus contextual fields (`requestId`, `route`, `userId`, etc.). Ship to your log aggregator with whatever sidecar you use.

In dev, set `LOG_PRETTY=1` to get colourised, human-readable lines via `pino-pretty`.

## Signals

| Signal | Behaviour |
|---|---|
| `SIGTERM` | Begin graceful shutdown: stop accepting new requests, drain in-flight for up to 30 s, close DB pools, exit 0 |
| `SIGINT` | Same as SIGTERM (dev convenience) |
| `SIGKILL` | Don't. You'll skip the drain and may leak Postgres connections briefly |

The worker additionally finishes its in-flight job on SIGTERM before exiting; bound the drain timeout with `WORKER_DRAIN_TIMEOUT_MS` (default 60 s).

## Reverse proxy

Production deployments terminate TLS at a reverse proxy in front of the API and web — Caddy, nginx, Cloudflare, or your cloud LB. Required header pass-through:

```
Forwarded-For        →  X-Forwarded-For        (used for rate-limit identity in absence of bearer)
Forwarded-Proto      →  X-Forwarded-Proto      (used to set Secure on cookies)
Notion-Version       →  Notion-Version         (passed through; required on /v1)
Authorization        →  Authorization          (passed through)
```

For WebSocket, ensure `Upgrade` and `Connection` are forwarded. Caddy and nginx both do this by default; cloud LBs vary.

## Tips

- Always run the worker as a separate process from the API in production — long-running export jobs will starve request handlers if you co-locate.
- On Kubernetes, give the worker a higher `terminationGracePeriodSeconds` (90+) than the API (30). The worker's drain takes longer.
- Don't put the API behind a proxy that buffers requests (some default WAF configurations do). Streaming endpoints — exports, large uploads — get killed otherwise.
- Pin the Node version in your container base image to `22-bookworm-slim` or newer. Earlier 22 patch releases have a bug in the WebSocket implementation that affects long-lived connections.
