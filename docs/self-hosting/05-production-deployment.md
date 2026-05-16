# Production deployment

What changes when you stop running `pnpm dev` and start running Bloc for real.

## Pre-flight checklist

- [ ] `NODE_ENV=production` set on every process.
- [ ] `SESSION_SECRET` and `TOKEN_V2_SECRET` are unique, ≥ 32 random bytes, not the dev defaults.
- [ ] `MEILI_MASTER_KEY` is unique and ≥ 32 random bytes.
- [ ] `DATABASE_URL` includes `?sslmode=require`.
- [ ] `REDIS_URL` uses `rediss://` if your provider supports it.
- [ ] S3 bucket has the `tmp/*` and `exports/*` lifecycle rules from [Configuration](./02-configuration.md).
- [ ] TLS terminates at your reverse proxy, not in Bloc itself.
- [ ] Backup job is in place and you've tested a restore at least once.
- [ ] Metrics endpoint (`/metrics`) is scraped by Prometheus or equivalent.
- [ ] An alert is firing for `up == 0` on each component.

## Reference topology

```
                     ┌───────────────────────┐
                     │   CDN / Edge proxy    │  (Cloudflare, fronts the LB)
                     └───────────┬───────────┘
                                 │  TLS
                     ┌───────────▼───────────┐
                     │  Reverse proxy / LB   │  (nginx / Caddy / cloud LB)
                     └─────┬─────────┬───────┘
                  /web/*   │         │  /v1/*, /api/v3/*, /ws
                ┌──────────▼──┐   ┌──▼──────────┐
                │   web x N   │   │   api x N    │
                │  (next.js)  │   │   (Hono)     │
                └─────────────┘   └──┬───────────┘
                                     │
                                     │ ┌───────────────┐
                                     ├─│ Postgres + RR │  (primary + read replicas)
                                     │ └───────────────┘
                                     │ ┌───────────────┐
                                     ├─│  Redis        │  (master + replica)
                                     │ └───────────────┘
                                     │ ┌───────────────┐
                                     ├─│  MeiliSearch  │  (1 node; backup via snapshots)
                                     │ └───────────────┘
                                     │ ┌───────────────┐
                                     └─│  S3 / R2 / …  │
                                       └───────────────┘
                                            ▲
                                            │
                                  ┌─────────┴─────────┐
                                  │   worker x M      │
                                  └───────────────────┘
```

## TLS

Bloc speaks plaintext HTTP inside the cluster. Always terminate TLS at the proxy.

- The web app sets `Secure` cookies when `X-Forwarded-Proto: https` is present.
- The realtime WebSocket requires `wss://` from the browser; the proxy must forward `Upgrade: websocket`.

## Cookies & cross-origin

If `apps/web` and `apps/api` run on different origins (e.g. `app.example.com` and `api.example.com`):

- Set `CORS_ALLOW_ORIGIN=https://app.example.com` on the API.
- Set `SESSION_COOKIE_DOMAIN=.example.com` so the cookie is sent to both.
- Set `SESSION_COOKIE_SAMESITE=lax` (default). Use `none` only if you genuinely need cross-site requests; that requires `secure: true` and breaks Safari ITP edge cases.

## Database

- Postgres ≥ 16, ideally 16.4+.
- Provision with at least 4 vCPU / 16 GB RAM / NVMe storage for any workspace > a few thousand pages.
- Tune `shared_buffers ≈ 25%` of RAM, `effective_cache_size ≈ 75%`, `wal_compression=on`, `wal_level=replica` (or `logical` if you use CDC).
- Set `max_connections` ≥ `pool_max × replicas × 2`.
- Use a managed Postgres (RDS, Cloud SQL, Crunchy, Supabase, Neon) unless you have a good reason not to.

## Redis

- Single-node is fine until your traffic justifies more.
- Configure `maxmemory-policy=allkeys-lru` — Bloc treats Redis as a cache for rate-limit buckets; eviction is safe.
- Enable persistence (AOF or RDB snapshots) only if you want to preserve rate-limit state across restarts. Otherwise disable for throughput.

## MeiliSearch

- One node is the supported topology in v1; Meili clustering isn't on the roadmap.
- Snapshot to S3 daily; restoring from snapshot is faster than re-indexing from Postgres.
- If the index falls behind (`search_index_lag_seconds` > 60), run `pnpm --filter worker run reindex --since=<ISO>` to backfill.

## S3

- Any S3-compatible: AWS S3, Cloudflare R2, Tigris, Wasabi, MinIO, Garage.
- Bucket policy must allow the Bloc IAM principal `GetObject`, `PutObject`, `DeleteObject`, `ListBucket`, `GetObjectAttributes`.
- Object versioning: optional, but recommended — costs nothing for low write volumes and gives you a free recovery window.

## SMTP

- Use a transactional provider (SES, Postmark, SendGrid, Resend). Don't try to run a mail server.
- Configure SPF + DKIM + DMARC on the sender domain. Bloc generates the unsubscribe header automatically.

## Observability

- **Logs**: ship stdout JSON to your log aggregator. The `requestId` field is the join key for traces.
- **Metrics**: scrape `/metrics` on the API and worker every 15 s. The collector at `tools/otel/collector-config.yaml` is a template, not a recommendation.
- **Traces**: point `OTEL_EXPORTER_OTLP_ENDPOINT` at your tracing backend (Tempo, Honeycomb, Jaeger, Datadog).

See [Reporting](../reporting/README.md) for the catalogue of what's emitted and the recommended alerts.

## Secrets

Bloc reads secrets from env. Don't bake them into images. Mount them at startup from your secret manager (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault, sops, Kubernetes Secret + CSI, …).

Rotate `SESSION_SECRET` quarterly. Rotation invalidates active sessions; plan a maintenance window or do it during low traffic.

## Capacity sizing rule-of-thumb

| Workspace size | API replicas | Worker replicas | Postgres | Redis |
|---|---|---|---|---|
| < 50 users, < 10k pages | 1 | 1 | 2 vCPU / 8 GB | 1 GB |
| 50–500 users, < 100k pages | 2 | 1 | 4 vCPU / 16 GB | 2 GB |
| 500–5k users, < 1M pages | 4–6 | 2 | 8 vCPU / 32 GB + 1 RR | 4 GB + replica |
| > 5k users | 8+ | 4+ | sharded by workspace | clustered |

Numbers are conservative; we measure once you have real load.

## Going further

- [Scaling](./06-scaling.md) — bottlenecks and how to relieve them.
- [Backups & disaster recovery](./07-backups-and-recovery.md) — the runbook.
- [Upgrades](./08-upgrades.md) — migration discipline.
- [Tips & gotchas](./09-tips-and-gotchas.md) — practical things that bite people.
