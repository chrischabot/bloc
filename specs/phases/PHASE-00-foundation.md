# Phase 0 — Foundation & Tooling

## Goal

Empty repo → fully wired monorepo with linting, types, tests, observability, dev services, and CI green on `main`.

## Read first

- `docs/README.md`
- `docs/PLAN.md#phase-0--foundation--tooling`
- `docs/prompts/AGENT-INSTRUCTIONS.md`
- `docs/architecture/01-tech-stack.md`
- `docs/architecture/02-monorepo-structure.md`
- `docs/testing/00-testing-strategy.md`
- `docs/testing/01-biome-config.md`
- `docs/testing/08-benchmarks.md`
- `docs/observability/00-tracing.md`

## Deliverables

1. `package.json` (root) with workspace `pnpm-workspace.yaml`, `turbo.json`, exact pnpm version pinned via `packageManager`.
2. `tsconfig.base.json` with strict settings; each package extends it.
3. `biome.json` with config per `docs/testing/01-biome-config.md`.
4. `docker-compose.yml` with services from `docs/architecture/01-tech-stack.md#local-development-services`.
5. Every package directory from `docs/architecture/02-monorepo-structure.md` exists with a minimal `package.json` + `src/index.ts`.
6. `packages/observability` is wired (logger, tracing, metrics — even though they currently observe nothing real).
7. `apps/api`, `apps/web`, `apps/worker` boot in dev (`pnpm dev`) and respond to a health endpoint / render a placeholder page / log a heartbeat respectively.
8. CI: `.github/workflows/ci.yml` runs lint, typecheck, unit, integration, e2e-smoke, benchmark-smoke, chaos-smoke jobs; required on PRs.
9. `tools/benchmark/` CLI shell that runs autocannon against the API health endpoint and emits a JSON report.
10. `tools/screenshot/` shell that visits a URL via Playwright and saves a PNG.
11. `tests/observability/assert-trace.ts` helper.
12. `reference/screenshots/` populated with reference shots fetched from notion.so and developers.notion.com (use `Browser Operator` against:
    - `https://www.notion.so/templates`
    - `https://www.notion.so/help/use-the-app-sidebar`
    - `https://developers.notion.com/reference/intro`
    - any public template page).

## Todos (mirror in PLAN.md as you tick)

- [ ] 0.1 monorepo init
- [ ] 0.2 Biome config + pre-commit
- [ ] 0.3 TS project refs strict
- [ ] 0.4 Vitest workspace
- [ ] 0.5 Playwright setup
- [ ] 0.6 Postgres in compose
- [ ] 0.7 Redis in compose
- [ ] 0.8 MeiliSearch in compose
- [ ] 0.9 OTEL wiring
- [ ] 0.10 pino logger
- [ ] 0.11 prom-client metrics
- [ ] 0.12 GitHub Actions workflows
- [ ] 0.13 benchmark CLI shell
- [ ] 0.14 observability test helper
- [ ] 0.15 reference screenshots

## Definition of Done

- `pnpm install && pnpm biome check . && pnpm typecheck && pnpm test && pnpm test:e2e -- --grep smoke && pnpm bench -- --smoke` runs green on a clean clone.
- All 15 todos ticked with evidence (commit SHA + workflow run URL).
- No file outside the tree described in `docs/architecture/02-monorepo-structure.md`.

## Verification commands

```bash
pnpm install
pnpm biome check .
pnpm typecheck
docker compose up -d
pnpm db:migrate
pnpm dev &
sleep 5
curl -fsS http://localhost:3001/health    # apps/api
curl -fsS http://localhost:3000           # apps/web (HTML)
pnpm test
pnpm test:e2e -- --grep smoke
pnpm bench -- --smoke
```

## Common pitfalls

- Forgetting `packageManager` in root `package.json` → CI uses wrong pnpm.
- Biome's `extends` graph missing package-level overrides.
- OTEL exporter pointed at a missing collector → traces silently dropped. Validate by emitting a span and asserting it lands.