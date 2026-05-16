# Upgrades

Bloc moves fast. Upgrades are forward-only and require some discipline.

## Versioning

Bloc tags releases as `vX.Y.Z`:

- **X** — major: breaking schema or API change. Read the release notes.
- **Y** — minor: feature additions, additive schema migrations, no breaking API. Safe to take on a normal cadence.
- **Z** — patch: bug fixes, security updates. Take promptly.

The `Notion-Version` header has its own date-based scheme; advancing Bloc rarely advances `Notion-Version`. They're orthogonal.

## Standard upgrade flow

```bash
git fetch && git checkout vX.Y.Z
pnpm install
pnpm db:migrate          # apply new migrations
pnpm build               # produce new artefacts
# blue/green: bring up new replicas, drain old
```

For a blue/green rollout:

1. Run `pnpm db:migrate` against prod. The migrations are designed to be **backwards compatible with the running version** — old replicas keep working after the migration runs.
2. Bring up new replicas (`vX.Y.Z`) alongside the old (`vX.Y-1.Z`).
3. Shift traffic; drain the old replicas.
4. Apply any post-deploy cleanup migrations (those marked `--phase=post`).

For minor / patch releases this is straightforward. Major releases call out departures from this flow in the release notes.

## Migration discipline

- Each migration is **either** additive (new table, new column with default, new index) **or** transformative (data backfill) **or** destructive (column drop, table drop). Bloc never mixes them in one file.
- Destructive migrations are tagged `--phase=post` and only run *after* every replica is on the new code. Skipping the new-code-first rule will break the old replicas.
- The migration runner won't apply a `--phase=post` migration unless the schema version recorded in `bloc.schema_version` is at least the version the migration belongs to.

## Downgrade

Bloc does not support downgrade in production. If you need to roll back:

1. Stop the new replicas.
2. Restore Postgres to a backup taken **before** the upgrade.
3. Restore S3 / MeiliSearch as needed (usually they're forward-compatible and don't need restore).
4. Bring up old replicas.

For minor releases this is rare. For major releases, take a fresh `pg_basebackup` immediately before running `pnpm db:migrate` so the rollback target is a few minutes old.

## Compatibility windows

Bloc supports the previous **two** minor releases for client SDKs. If you're on `@bloc/sdk@1.4.x`, a Bloc server running `v1.6.x` will still accept your requests. Beyond that, behaviours start being deprecated.

The public REST `Notion-Version` is independently versioned; Bloc supports the **four** most recent versions, and silently coerces older ones to the latest.

## Schema upgrades you have to handle yourself

A short list of upgrades that the migration system can't fully automate:

- **Re-indexing search** after a Meili minor upgrade. Run `pnpm --filter worker run reindex`.
- **Re-rendering custom domain certificates** after rotating `TOKEN_V2_SECRET`. The Sites publisher invalidates and re-issues; no action needed but expect a brief window where new visits hit the staging cert.
- **OAuth client migrations** if the consent screen copy changed. New clients use the new copy; existing clients keep their original copy.

## Release notes

The `CHANGELOG.md` (under `specs/` for the build, separately under `releases/` for shipped versions) calls out every breaking change. Read it before bumping.
