# Storage Strategy

## Stores

| Store | Role | Strong consistency? |
|-------|------|---------------------|
| Postgres 16 | System of record | Yes |
| Redis 7 | Cache, rate limit, pub/sub for realtime fanout | No (cache is best-effort) |
| MeiliSearch 1.10 | Full-text search index | Eventually consistent; worker-driven |
| S3-compatible | File blobs | Strong read-after-write within a region |

## Read paths

### Page read

1. Resolve permissions from Postgres (cached 30s per `(user_id, page_id)` in Redis).
2. Read page row + properties from Postgres.
3. For block children — direct Postgres query with `(parent_id, position)` index. No caching: block trees mutate often and stale reads are user-visible.
4. Serialise via shared schemas, return.

### Search

1. Search query goes to MeiliSearch (`search-pages`, `search-blocks` indexes).
2. Top N results returned to API, which filters by ACL **server-side** (MeiliSearch's filterable attributes carry `workspace_id`, `acl_signature`; we still re-check on the way out for safety).
3. Result hydration: minimal — title, snippet, parent breadcrumb.

## Write paths

### Block mutation

1. Begin Postgres transaction.
2. Validate body against Zod schema.
3. Resolve permission (cached read OK; if write rejected, no further state changes).
4. Apply mutation, bump page `last_edited_*`, write audit event.
5. Commit.
6. Publish event to Redis channel `workspace:{id}:page:{page_id}` for realtime + indexer.
7. Indexer worker consumes event, debounces 500ms per page, re-indexes to MeiliSearch.

### Database query

1. Compile filter+sort to SQL — implementation in `packages/db/src/query-engine.ts`.
2. For formula/rollup-dependent filters, evaluate after-the-fact in Node when SQL-side evaluation isn't feasible (e.g. formulas referencing user-defined expressions). Document the line in the query-engine docstring.
3. Stream rows when result size > 1000; return paginated otherwise.

## Caching

| Key | TTL | Invalidation |
|-----|-----|--------------|
| `perm:{user_id}:{resource_type}:{resource_id}` | 30s | Invalidate on `permissions` mutation |
| `user:{id}` | 60s | Invalidate on user update |
| `workspace:{id}` | 60s | Invalidate on workspace update |
| `db-schema:{database_id}` | 300s | Invalidate on `database_properties` mutation |

Caching anything page-content-related is forbidden — collaborative editing demands fresh reads.

## Pub/Sub channels

- `workspace:{id}:page:{page_id}` — block / property / page mutations on that page
- `workspace:{id}:db:{database_id}` — schema mutations
- `user:{id}:inbox` — notification fanout

Realtime gateway subscribes per page on connection; ACL is checked at subscribe time and revalidated on each `update` message reused by Yjs awareness.

## File storage

- Uploads: client gets a pre-signed URL via `POST /v1/files`; uploads directly to S3.
- Reads: API issues a 30-minute pre-signed URL; URL is refreshed on every block load that references the file.
- Image transforms: an edge function (`/cdn/image?key=...&w=...&format=...`) handles resize and webp/avif conversion; cache TTL 1 day.

## Consistency model

- **Read-after-write within a page**: strong (single Postgres primary; reads not from replicas for hot endpoints).
- **Search**: eventual, target 2s convergence; tests assert ≤ 5s.
- **Permissions**: a permission change becomes effective within 30s due to cache; for critical paths (revoke), the API issues a `DEL perm:*` glob via Redis Lua.

## Backups

- Postgres: continuous WAL archival, 7-day PITR.
- Files: bucket versioning + lifecycle to glacier after 90 days for unused.
- MeiliSearch: rebuildable from Postgres; no separate backups.

## Disaster recovery RPO/RTO

- RPO: ≤ 5 minutes (WAL shipping).
- RTO: ≤ 60 minutes (warm standby).

## Sharding strategy (production target)

Notion documents a 32 physical × 15 logical = **480 logical shard** layout keyed by `workspace_id`. We adopt the same target architecture so the replica scales by the same horizontal axis Notion does. Sharding ships in a later phase; v1 runs single-primary.

- Logical shard selection: `shard_id = crc32(workspace_id) % 480`.
- Logical → physical mapping table maintained centrally in a small `shard_map` Postgres instance, replicated read-only to every app server (cached 5 s).
- Cross-shard queries (e.g. `POST /v1/search`) are fanned out by the search index, not by Postgres — Postgres is workspace-scoped on the hot path.
- Migrations to add a new physical shard: double-write the affected logical shards to the new physical, dark-read for verification, cutover, drop the old copy. The procedure is documented in `docs/operations/shard-migration.md` (created when shards are added).
- pgbouncer pools sit in front of every physical primary in transaction-pool mode; per-app-pod connection budget 32, server-side max 1024.

## Connection pooling

- **App ↔ pgbouncer (transaction pool)**: each app pod opens up to 32 connections; pgbouncer maintains 1024 backend connections per physical primary.
- **Replica reads**: hot reads stay on the primary (collaborative editing requires fresh state); cold / analytics reads use a read replica via a separate pool.
- **Worker ↔ Postgres**: dedicated pool; long-running batch jobs use a separate "batch" pool (16 connections) to isolate latency.

## Data lake (analytics + AI pipeline)

A separate analytics path offloads block-level history into a data lake:

- Source: Postgres logical decoding of the `blocks` and `block_updates` tables → Kafka topic per workspace shard.
- Sink: **Apache Hudi** tables on S3 (Parquet + log files), keyed by `workspace_id` + `page_id`.
- Cadence: 4-hour incremental compaction (Notion's documented cadence for downstream consumers).
- Consumers:
  - **AI/embedding pipeline** (see `docs/frontend/18-ai.md`) reads recent partitions to refresh page embeddings.
  - **Workspace analytics** (`docs/frontend/34-version-history-analytics-audit.md#page-analytics`) reads from rolled-up tables.
  - **Audit log archival** beyond Postgres retention.
- The lake is **never** the source of truth for product queries; if Hudi is down, the product is unaffected.

The data lake is operated by the `apps/data-pipeline/` service (a separate deployable from the API workers).