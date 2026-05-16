# Monorepo Structure

## Tree

```
.
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── blocks.ts
│   │   │   │   ├── pages.ts
│   │   │   │   ├── databases.ts
│   │   │   │   ├── users.ts
│   │   │   │   ├── comments.ts
│   │   │   │   ├── search.ts
│   │   │   │   └── auth.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── rate-limit.ts
│   │   │   │   ├── notion-version.ts
│   │   │   │   ├── error.ts
│   │   │   │   └── trace.ts
│   │   │   ├── ws/                 # WebSocket Yjs gateway
│   │   │   ├── server.ts
│   │   │   └── index.ts
│   │   ├── tests/                  # API-local unit tests
│   │   └── package.json
│   │
│   ├── web/
│   │   ├── app/                    # Next.js app router
│   │   │   ├── (workspace)/
│   │   │   │   ├── [pageId]/page.tsx
│   │   │   │   ├── search/page.tsx
│   │   │   │   └── settings/page.tsx
│   │   │   ├── api/                # Next.js route handlers for BFF
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── styles/
│   │   ├── public/
│   │   └── package.json
│   │
│   └── worker/
│       ├── src/
│       │   ├── jobs/
│       │   │   ├── index-page.ts
│       │   │   ├── recompute-rollup.ts
│       │   │   ├── send-email.ts
│       │   │   ├── export-page.ts
│       │   │   └── sweep-deleted.ts
│       │   └── index.ts
│       └── package.json
│
├── packages/
│   ├── shared/                     # Zod schemas, types, error classes, constants
│   │   ├── src/
│   │   │   ├── blocks/             # One file per block type schema
│   │   │   ├── properties/         # One file per property type schema
│   │   │   ├── rich-text.ts
│   │   │   ├── errors.ts
│   │   │   ├── pagination.ts
│   │   │   ├── version.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── db/
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   ├── migrations/
│   │   │   ├── repositories/
│   │   │   └── client.ts
│   │   └── package.json
│   │
│   ├── sdk/
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── blocks.ts
│   │   │   ├── pages.ts
│   │   │   ├── databases.ts
│   │   │   ├── users.ts
│   │   │   ├── comments.ts
│   │   │   └── search.ts
│   │   └── package.json
│   │
│   ├── editor/
│   │   ├── src/
│   │   │   ├── block-tree/
│   │   │   ├── rich-text/
│   │   │   ├── commands/
│   │   │   ├── plugins/
│   │   │   ├── slash-menu/
│   │   │   ├── formatting-toolbar/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── ui/
│   │   ├── src/
│   │   │   ├── tokens/
│   │   │   ├── primitives/
│   │   │   ├── components/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── observability/
│       ├── src/
│       │   ├── tracing.ts
│       │   ├── logger.ts
│       │   ├── metrics.ts
│       │   └── index.ts
│       └── package.json
│
├── tests/
│   ├── unit/                       # Cross-package unit tests if needed
│   ├── integration/
│   ├── contract/
│   ├── sdk-progressive/
│   ├── e2e/
│   ├── visual/
│   ├── benchmark/
│   └── chaos/
│
├── tools/
│   ├── benchmark/                  # p50/p99 CLI
│   ├── seed/                       # Demo workspace generator
│   ├── screenshot/                 # Reference shot fetcher
│   └── codegen/                    # SDK + Zod generation
│
├── benchmarks/
│   └── reports/
│
├── reference/
│   └── screenshots/
│
├── docs/
│
├── docker-compose.yml
├── biome.json
├── turbo.json
├── tsconfig.base.json
├── package.json
└── pnpm-workspace.yaml
```

## Import boundaries (enforced by Biome's `noRestrictedImports`)

- `apps/web` may import: `packages/sdk`, `packages/ui`, `packages/editor`, `packages/shared`, `packages/observability`.
- `apps/api` may import: `packages/db`, `packages/shared`, `packages/observability`.
- `apps/worker` may import: `packages/db`, `packages/shared`, `packages/observability`.
- `packages/sdk` may import: `packages/shared` only.
- `packages/db` may import: `packages/shared` only.
- `packages/editor` may import: `packages/shared`, `packages/ui` only.
- `packages/ui` may import: `packages/shared` only.
- `packages/observability` is leaf — imports nothing from the workspace.
- `packages/shared` is leaf.

Backward references (e.g. `packages/shared` importing from `apps/`) are forbidden.

## Naming conventions

- Directories: `kebab-case`.
- Files: `kebab-case.ts` for modules and tests; `PascalCase.tsx` for React components.
- Test files: `*.test.ts` colocated with subject, or under `tests/<kind>/...`.
- One default export per React component file; named exports for everything else.

## Workspace scripts (root `package.json`)

| Script | Action |
|--------|--------|
| `pnpm dev` | Turbo runs `dev` in `apps/web`, `apps/api`, `apps/worker` in parallel |
| `pnpm build` | Turbo builds all packages and apps |
| `pnpm test` | Vitest across the entire workspace |
| `pnpm test:e2e` | Playwright |
| `pnpm test:visual` | Visual regression |
| `pnpm test:chaos` | Chaos harness |
| `pnpm bench` | Benchmark CLI |
| `pnpm biome check .` | Lint + format check |
| `pnpm typecheck` | `tsc -b` across all projects |
| `pnpm db:migrate` / `pnpm db:reset` / `pnpm db:seed` | Database lifecycle |