# Database

Bloc's authoritative store is Postgres 16+. Everything else is derivable.

## Migrations

Schema lives under [`packages/db/src/migrations`](../../packages/db/src). The migration runner is `pnpm db:migrate`:

```bash
pnpm db:migrate            # apply pending up-migrations
pnpm db:migrate -- --dry   # print the SQL it would run
pnpm db:reset              # drop schema, re-apply, re-seed (DESTRUCTIVE)
```

Migrations are **forward-only** in production. Down-migrations exist in the codebase as a courtesy for local rollback but are not part of the supported upgrade path. See [Upgrades](./08-upgrades.md) for the discipline.

The migration table `__migrations` records `name`, `applied_at`, `checksum`. Bloc refuses to start if the checksum of a file on disk doesn't match what was recorded — that means the migration was edited after being applied, which is a footgun.

## Seeding

`pnpm db:seed` creates:

- One workspace named `Demo`.
- One admin user `demo@bloc.local`.
- A handful of pages and one database with sample rows.
- A bootstrap bearer token; printed to stdout.

The seed is idempotent — running it twice is a no-op.

## Schema highlights

You don't normally read the schema directly, but the load-bearing tables are:

| Table | Holds |
|---|---|
| `workspaces` | Tenants |
| `users`, `workspace_members`, `groups`, `group_members` | Identity |
| `pages` | Pages + database rows (same table, discriminator on `parent_type`) |
| `blocks` | Block tree (one row per block, `parent_block_id` + `position` orders siblings) |
| `databases` | Database metadata (schema lives on the row in `properties` JSONB) |
| `data_sources` | Per-database data sources |
| `properties` | Optional split-out values (history of every property write) |
| `permissions` | Per-page ACL grants |
| `comments`, `discussions` | Inline comments |
| `webhooks`, `webhook_deliveries` | Outbound webhook subscriptions + delivery log |
| `page_updates`, `page_version_snapshots`, `page_versions` | Realtime op log + versions |
| `analytics_events`, `audit_events` | Reporting tables |
| `automations`, `automation_runs` | Database automations |
| `forms`, `form_submissions` | Public form definitions + submissions |
| `reminders` | Time-based reminders fired by the worker |
| `sites_publications`, `sites_custom_domains` | Sites publishing |

Indexes are documented inline in the migration files. Notable: `pages` has a GIN index on `properties` for property-based filtering, and `blocks` has a (`parent_id`, `position`) compound for ordered list reads.

## Connection pool

Each API process opens up to `DATABASE_POOL_MAX` connections (default 20). With three API replicas and one worker, that's 80 connections — well under the default Postgres `max_connections=100`. If you scale beyond a few replicas, use **pgbouncer** in transaction-pooling mode.

The worker holds one long-running listener connection for `LISTEN/NOTIFY`; the rest of its pool is for batch work.

## Backups

Use `pg_basebackup` for full + WAL streaming; configure an off-host replica or stream WAL to S3 with `wal-g`. See [Backups & disaster recovery](./07-backups-and-recovery.md) for the runbook.

## Restoring search & files after a restore

After restoring Postgres from backup:

1. Wipe and rebuild the MeiliSearch index: `pnpm --filter worker run reindex`. The worker drains the entire `pages` and `blocks` tables back into Meili. Expect ~20 min per million blocks.
2. Files in S3 are independent — if your S3 backup is point-in-time aligned with the Postgres backup, you're done. Otherwise some upload references in Postgres may dangle. The worker has a sweep that 404s them on read.

## Trash retention

`DELETE` on a page or block sets `archived: true, in_trash: true`. The worker's `trash-sweep` job hard-deletes anything with `in_trash_at < now() - interval '30 days'`. Retention is fixed at 30 days in v1.

## DDL discipline

Don't run schema migrations against a Bloc Postgres outside the migration runner. Bloc relies on its own migration table to know what's applied, and ad-hoc `ALTER TABLE` will silently break upgrades.
