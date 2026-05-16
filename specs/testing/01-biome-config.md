# Biome Configuration

## File

`biome.json` at repo root.

## Required settings

- `formatter.enabled: true`
- `formatter.indentStyle: "space"`
- `formatter.indentWidth: 2`
- `formatter.lineWidth: 100`
- `formatter.lineEnding: "lf"`
- `linter.enabled: true`
- `organizeImports.enabled: true`
- VCS integration: `vcs: { enabled: true, useIgnoreFile: true }`

## Recommended rule set

- All recommended rules enabled.
- `nursery.useImportRestrictions` configured per the import boundaries in `docs/architecture/02-monorepo-structure.md`.
- `style.noNonNullAssertion`: error.
- `suspicious.noExplicitAny`: error.
- `complexity.noUselessTypeConstraint`, `noUselessFragments`, `noBannedTypes`: error.
- `correctness.useExhaustiveDependencies`: error (React hooks).
- `a11y.*` recommended set: error.

## Per-file overrides

- `tests/**`: relax `noExplicitAny` to warn; allow `console.log`.
- `**/*.stories.tsx`: relax `useDefaultParameterLast`.
- `**/migrations/**`: disable formatting (Drizzle-emitted SQL).

## CLI

- Local: `pnpm biome check .`
- Auto-fix: `pnpm biome check . --write`
- CI: `pnpm biome ci .` (exit 1 on any issue, no auto-fix).

## Pre-commit

`tools/git-hooks/pre-commit`:

```bash
#!/usr/bin/env bash
pnpm biome check --staged --no-errors-on-unmatched || exit 1
pnpm -w typecheck || exit 1
```

Wired via `lefthook` or `simple-git-hooks` in root `package.json`.

## Editor

- `.vscode/settings.json` sets Biome as default formatter; format on save.
- `.vscode/extensions.json` recommends the Biome extension.

## Verification

`pnpm biome check .` exits 0 on a clean tree.