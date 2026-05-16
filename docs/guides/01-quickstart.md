# Quickstart

Bloc up and running in five minutes. Mac / Linux / WSL.

## Prereqs

- Node 22+
- pnpm 10+
- Docker + Docker Compose

```bash
node -v          # v22.x
pnpm -v          # 10.x
docker -v
```

## Clone & install

```bash
git clone https://github.com/chrischabot/bloc.git
cd bloc
pnpm install
cp .env.example .env
```

## Start the services

```bash
docker compose up -d
```

Brings up Postgres, Redis, MeiliSearch, MinIO, Mailpit, and an OTel collector.

## Migrate + seed

```bash
pnpm db:migrate
pnpm db:seed
```

## Run

```bash
pnpm dev
```

In another terminal:

```bash
open http://localhost:3000   # mac
# or: xdg-open / start
```

The first load auto-provisions a workspace + a dev bearer token, printed to the browser console. Copy it; that's `BLOC_TOKEN`.

## Hit the API

```bash
export BLOC_TOKEN=...
curl -H "Authorization: Bearer $BLOC_TOKEN" \
     -H "Notion-Version: 2025-09-03" \
     http://localhost:3001/v1/users/me
```

Expected response: `{"object":"user","id":"...","type":"person","name":"Demo User", ...}`.

## Use the SDK

```bash
pnpm add @bloc/sdk
```

```ts
import { Bloc } from '@bloc/sdk';

const bloc = new Bloc({ auth: process.env.BLOC_TOKEN!, baseUrl: 'http://localhost:3001' });
const me   = await bloc.users.me();
console.log('Hello,', me.name);
```

## What's next

- [Your first API call](./02-first-api-call.md) — create a page, append blocks, query the database.
- [Self-hosting](../self-hosting/README.md) — for deploying somewhere real.
- [Web tour](../web/01-tour.md) — for the UX.
