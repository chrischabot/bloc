# Tech Stack

All choices below are normative. Substitutions require an updated spec in the same change-set.

## Languages & runtimes

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Backend runtime | **Node.js 22 LTS** | Stable LTS, native fetch, native test runner if needed, broad ecosystem. Bun is permitted for the worker if it materially improves perf, but the API must remain Node-compatible. |
| Frontend runtime | **Browser + Node 22 for SSR** | Next.js requirement |
| Language | **TypeScript 5.6+** strict | Single language across the stack; type-sharing via `packages/shared` |
| Package manager | **pnpm 9+** | Fast, deterministic, efficient for monorepos |
| Build orchestrator | **Turborepo** | Caching across packages, parallel task graphs |

## Backend

| Concern | Choice | Notes |
|---------|--------|-------|
| HTTP framework | **Hono** | Tiny, fast, edge-ready, excellent TS DX |
| Validation | **Zod 3** | Schemas authored once in `packages/shared`, used by API + SDK + DB layer |
| ORM | **Drizzle ORM** | Type-safe SQL, migrations, supports raw SQL escape hatches needed for query engine |
| DB driver | `postgres` (porsager) | Faster than `pg`, supports prepared statements + LISTEN/NOTIFY |
| Auth | **lucia-auth** (or custom) | Session-based for the app; bearer-token middleware for integrations |
| Realtime | **Yjs** + `y-websocket`-style gateway | CRDT for block tree |
| Background jobs | **BullMQ** on Redis | Mature, good observability |
| Email | **Resend** (provider) | Replaceable via interface |
| File storage | **S3-compatible** (R2, MinIO for local) | Pre-signed URLs |
| Search | **MeiliSearch** | Easy to operate, fast typo-tolerant FTS; Elasticsearch acceptable substitute for scale |

## Frontend

| Concern | Choice | Notes |
|---------|--------|-------|
| Framework | **Next.js 15 (App Router)** | RSC + streaming + server actions where appropriate |
| UI library | **React 19** | Concurrent features, `use` hook, transitions |
| Styling | **CSS Modules + design tokens** (HSL custom properties) | Avoid utility-class sprawl in editor; Tailwind tokens permitted in `packages/ui` for spacing/typography utilities. Notion's design is highly bespoke — pure utility classes hinder pixel-matching. |
| Editor | **Custom** built on `packages/editor` (Yjs document + ProseMirror-style schema, but custom — see `docs/frontend/05-editor.md` for rationale) | Tiptap/Lexical do not give us the exact block model we need |
| Icons | **lucide-react** + custom Notion-style emoji renderer | |
| Date | **date-fns** | Calendar view, timeline view |
| Drag and drop | **dnd-kit** | Sidebar reordering, block drag, board view |
| Charts (database) | **visx** for timeline; calendar uses raw grid | |
| Math | **KaTeX** | Equation blocks, inline equations |
| Syntax highlighting | **Shiki** | High-fidelity, themeable |

## Observability

| Concern | Choice |
|---------|--------|
| Tracing | OpenTelemetry SDK → OTLP → Tempo/Jaeger |
| Logging | pino (JSON) → Loki/CloudWatch |
| Metrics | prom-client → Prometheus → Grafana |
| Error reporting | Sentry (browser + server) |

## Testing

| Concern | Choice |
|---------|--------|
| Lint + format | **Biome** (single tool) |
| Unit / integration | **Vitest** with `vitest.workspace.ts` per package |
| Contract tests | Vitest + nock-free HTTP using `undici.MockAgent` only for outbound third-party; otherwise hit a real test server |
| E2E | **Playwright** |
| Visual regression | **Playwright + pixelmatch** with screenshots stored in `tests/visual/__snapshots__/` |
| Benchmarks | Custom CLI in `tools/benchmark/` using `autocannon` for HTTP, `tinybench` for in-process |
| Chaos | Custom harness in `tests/chaos/` using `fast-check` for property tests and a fuzz mode |

## Local development services

`docker-compose.yml` provides:

- `postgres:16-alpine`
- `redis:7-alpine`
- `getmeili/meilisearch:v1.10`
- `minio/minio` (S3)
- `otel/opentelemetry-collector-contrib`
- `grafana/tempo`, `grafana/loki`, `grafana/grafana`
- `axllent/mailpit` (SMTP for dev)

## Version pinning

- All `package.json` entries use exact versions (no `^`, no `~`).
- Renovate is configured to open weekly PRs; CI must remain green before merge.
- Major bumps require an updated `docs/CHANGELOG.md` entry.