# Backups & disaster recovery

What to back up, how often, and how to restore.

## What is and isn't authoritative

| Store | Authoritative? | Backup priority |
|---|---|---|
| **Postgres** | yes | Critical |
| **S3 (uploaded files)** | yes | Critical |
| **MeiliSearch** | no — rebuildable from Postgres | Snapshot for fast recovery, not required for correctness |
| **Redis** | no — rate limits + caches | Don't bother |

## Postgres

### Strategy

- **Daily logical dump** (`pg_dump --format=custom`) to an off-host bucket. Cheap, slow to restore but human-inspectable.
- **Continuous WAL streaming** to S3 via `wal-g` or `pgbackrest`. Enables point-in-time recovery (PITR) to any second within the retention window.
- **A standby replica** with streaming replication. Hot failover target.

A reasonable setup: daily logical dump retained 30 days + continuous WAL retained 7 days + one warm standby.

### Restore drill

You **must** run a restore drill at least quarterly. The runbook:

1. Provision a fresh Postgres instance.
2. Restore the latest base backup (`pg_basebackup` output or `wal-g restore-base`).
3. Replay WAL up to the target point in time.
4. Connect a non-prod Bloc API at the restored DB; run `pnpm db:migrate` (no-op if the dump is current); run health checks.
5. Browse a few pages, edit one, confirm the write lands.

If steps 1–4 take more than your RTO budget, you need a hotter strategy (synchronous replica + automatic failover).

## S3

### Strategy

- **Versioning on** the bucket. Free (or near-free) protection against accidental deletes.
- **Lifecycle rule** transitions old versions to cold storage (Glacier / Archive) after 30 days.
- **Cross-region replication** if you can afford it. Otherwise rely on the cloud provider's region durability claim.

### Restore

For accidental deletes, restore the prior object version. For a full bucket loss, fail over to the replicated region.

If S3 and Postgres get out of sync (Postgres restored from yesterday, S3 lost some objects from today), the worker's `file-reaper` sweep will mark dangling file references as `unavailable` on next read.

## MeiliSearch

### Strategy

- Take a Meili snapshot daily, write to S3. Restoring from snapshot is ~10× faster than re-indexing from Postgres.
- If you skip Meili snapshots, after a Meili-host failure run `pnpm --filter worker run reindex` and accept the rebuild window.

### Restore

```bash
# Stop MeiliSearch
docker compose stop meilisearch
# Replace volume with snapshot
docker run --rm -v meili-data:/data -v $(pwd):/src alpine \
  sh -c "rm -rf /data/* && tar xzf /src/meili-snapshot.tar.gz -C /data"
docker compose start meilisearch
```

If the snapshot is stale relative to Postgres, the worker's incremental reindex will catch it up.

## Order of restore

For a full disaster — losing all stateful services — restore in this order:

1. **Postgres** (the source of truth).
2. **S3** (asynchronous to Postgres, but block both before unblocking traffic).
3. Bring up **API**, **worker** with `RATE_LIMIT_DISABLE=1` temporarily so health checks can run before users hit a half-warm system.
4. **MeiliSearch** from snapshot if you have one, else `pnpm --filter worker run reindex`. Until this catches up, `/v1/search` returns partial results — surface a banner in the web app via `BANNER_TEXT` env var.
5. **Redis** — fresh, no restore needed.
6. Unblock traffic.

## RTO / RPO defaults

The defaults below assume the strategy on this page is followed.

| Metric | Default | What it means |
|---|---|---|
| **RPO** (recovery point) | 5 min | Worst-case data loss given continuous WAL |
| **RTO** (recovery time) | 30 min | Full-stack restore drill target |

Tighten by switching from logical dumps to synchronous replication (RPO → ~0) and standby auto-failover (RTO → minutes).

## What to back up that *isn't* in the data tier

- **Your `.env` / secrets** — not in the repo, easy to lose.
- **MeiliSearch master key** — necessary to access existing indexes.
- **OAuth client secrets** issued to integration developers — irreplaceable; if you lose them, every integration breaks.
- **Webhook signing secrets** — receivers reject deliveries signed with a different key.

Treat these as Tier-1 secrets and back them up in your secrets manager's own backup mechanism.
