# Scaling

Where Bloc bottlenecks, in approximate order of when you'll hit them.

## 1. Postgres connections

The first thing you'll exhaust. Each API replica opens up to `DATABASE_POOL_MAX` (default 20) and Postgres' default `max_connections` is 100.

**Fix**: introduce **pgbouncer** in transaction-pooling mode. Set `DATABASE_URL` to point at pgbouncer, set `DATABASE_POOL_MAX=5` per replica (because pgbouncer multiplexes), let pgbouncer hold the real connections.

Caveats: transaction-pool mode breaks `LISTEN/NOTIFY` and prepared statements. Bloc avoids prepared statements where it pools through pgbouncer; the worker uses a separate, session-pooled connection for its listener.

## 2. Hot pages

When dozens of clients edit one page, every op fans out via WebSocket and writes to `page_updates`. The write rate is the bottleneck.

**Symptoms**: `ws_message_duration_seconds` p99 climbs; clients see delayed `ack`s.

**Fixes**:

- Increase the per-page op coalescing window (`REALTIME_COALESCE_MS`, default 50 ms).
- Move the `page_updates` table to its own tablespace on faster storage.
- For *pathological* hot pages (thousands of concurrent editors — rare), shard the realtime fan-out by user-hash. Not configured out of the box; ask before you go there.

## 3. Search lag

The worker writes to MeiliSearch asynchronously. Under spike load the queue grows.

**Symptoms**: `search_index_lag_seconds` rises above 30.

**Fixes**:

- Add more worker replicas (the search batch is sharded by workspace).
- Move Meili to faster storage. The index is write-heavy and benefits from NVMe.
- For mass-import bursts, set `SEARCH_DRAIN_BACKOFF=1` on the worker so it stops fighting the live write path until the queue drains.

## 4. WebSocket connections

WS connections are cheap, but a single Node process tops out around 30–50k concurrent connections before event-loop latency degrades.

**Symptoms**: `ws_connections_active` climbing into the 5-digits per replica; sporadic disconnects.

**Fix**: scale the API horizontally. Sticky sessions on the WS endpoint by `x-bloc-session-id` cookie keep clients on the same replica.

## 5. Webhook delivery

If many workspaces subscribe to many events, the outbound HTTP fan-out becomes the bottleneck.

**Symptoms**: `webhook_delivery_pending` queue depth climbs; `webhook_delivery_duration_seconds` p99 rises.

**Fixes**:

- Run more worker replicas; the deliverer parallelises across them.
- Configure per-webhook concurrency with `WEBHOOK_MAX_INFLIGHT_PER_WEBHOOK=8` (default).
- Confirm slow receivers aren't blocking — Bloc retries with backoff but never drops; a dead receiver back-pressures the queue. Disable broken webhooks in the dashboard.

## 6. Exports & imports

Exports stream from Postgres → S3. Big workspace exports can take many minutes.

**Fix**: dedicate a worker replica to long jobs with `WORKER_ROLE=long`. The default scheduler routes exports/imports to long-role workers preferentially; short-role workers stay free for digests, reminders, search index.

## Horizontal scaling cheat sheet

| Process | Stateless? | Stickiness | Notes |
|---|---|---|---|
| `apps/api` (REST) | yes | none | Scale freely |
| `apps/api` (WS) | session-state in Redis | sticky by `x-bloc-session-id` | Drains gracefully on SIGTERM |
| `apps/web` | yes | none | Can cache `/_next/static/*` at the CDN |
| `apps/worker` | yes (with Redis lock) | none | One elected scheduler, rest are workers |

## Vertical scaling cheat sheet

| Service | Scale axis | When |
|---|---|---|
| Postgres | RAM > CPU > IOPS | First — query patterns are read-heavy |
| Redis | RAM | Only matters at very high request rates |
| MeiliSearch | IOPS, then RAM | Write-heavy at scale |
| S3 | n/a | Cloud, irrelevant |

## What *not* to do

- Don't put a CDN with HTML caching in front of `apps/web`. The app is heavily personalised; cache hits will serve another user's session.
- Don't try to cluster MeiliSearch. The supported topology is one node + snapshots.
- Don't co-locate the worker with the API on a single small node and expect both to be responsive. They're cooperative but not contention-free.
