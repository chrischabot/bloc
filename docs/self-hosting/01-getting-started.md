# Getting started

This walks you from a fresh clone to a running Bloc stack.

## Prerequisites

| Tool | Minimum | Why |
|---|---|---|
| **Node.js** | 22.0.0 | The API, web, worker, and SDK all target Node 22 features |
| **pnpm** | 10.0.0 | Monorepo dependency manager |
| **Docker** + Compose | recent | Brings up Postgres, Redis, MeiliSearch, MinIO, Mailpit, OTel collector |
| **Git** | any | Cloning |

Optional but recommended for local dev:

- **`tsx`** is installed as a dev-dependency for one-off scripts.
- **`mkcert`** if you want HTTPS locally.

## One-shot setup

```bash
git clone https://github.com/chrischabot/bloc.git
cd bloc
pnpm install
cp .env.example .env

docker compose up -d        # postgres, redis, meilisearch, minio, mailpit, otel-collector
pnpm db:migrate             # apply schema
pnpm db:seed                # demo workspace + page
pnpm dev                    # API, web, worker in parallel
```

When `pnpm dev` is healthy you should see:

- **Web** — http://localhost:3000
- **API** — http://localhost:3001 (`/v1/*`, `/api/v3/*`, `/metrics`, `/health`)
- **MinIO console** — http://localhost:9001 (`minioadmin` / `minioadmin`)
- **Mailpit** — http://localhost:8025 (catches outbound mail)

The first time you load http://localhost:3000 the app bootstraps a workspace and prints a **dev bearer token** in the browser console — copy it; that's what you'll pass as `Authorization: Bearer …` to the API.

## Verify the install

```bash
# Hits /health on the API — should return JSON with status: 'ok'.
curl http://localhost:3001/health

# Hit /v1/users/me with the bearer from the browser console.
curl -H "Authorization: Bearer $BLOC_TOKEN" \
     -H "Notion-Version: 2025-09-03" \
     http://localhost:3001/v1/users/me
```

If the second call returns a `UserObject`, the API + DB + auth path is wired up correctly.

## Bring the stack down

```bash
docker compose down              # stops + removes containers, keeps volumes
docker compose down --volumes    # also wipes Postgres / Meili / MinIO state
```

## Where the data lives

| Service | Container volume | What's in it |
|---|---|---|
| Postgres | `postgres-data` | All authoritative state |
| Redis | `redis-data` | Rate-limit buckets, pub/sub, presence |
| MeiliSearch | `meili-data` | Search index (rebuildable from Postgres) |
| MinIO | `minio-data` | Uploaded files |

Only Postgres is irreplaceable. Everything else is a cache or a rebuildable index.

## Next

- [Configuration](./02-configuration.md) — every env var documented.
- [Production deployment](./05-production-deployment.md) — what changes when you take it past localhost.
