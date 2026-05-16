# API Versioning

## Header

```
Notion-Version: 2026-04-01
```

- Always required.
- Unknown values return 400.
- The current baseline is `2026-04-01` (Notion's current GA contract as of May 2026, mirroring the live `developers.notion.com/reference` surface).
- Earlier versions remain supported per the deprecation policy below.

## Currently supported versions

`packages/shared/src/version.ts`:

```ts
export const SUPPORTED_VERSIONS = [
  '2022-06-28',  // legacy baseline; minimum still supported
  '2025-09-03',  // introduces data sources (see docs/architecture/10-data-sources.md)
  '2026-03-11',  // block-type rename: transcription → meeting_notes
  '2026-04-01',  // current baseline; standard rate-limit headers; AI surfaces GA
] as const;

export const LATEST_VERSION = '2026-04-01';
export type NotionVersion = typeof SUPPORTED_VERSIONS[number];
```

Each version string maps to a date and represents a breaking-change boundary. Adding a new field to a response is **not** a new version (additive within the current string). Removing a field, changing a field's shape, or changing a field's semantics requires a new version.

### Per-version notable changes (this replica)

| Version | Changes |
|---------|---------|
| `2022-06-28` | Original GA baseline. `database_id` is the addressable handle. |
| `2025-09-03` | Data sources primitive introduced. `data_source_id` becomes accepted. Webhooks GA (50 subscriptions per integration; no user-change / workspace-settings events). |
| `2026-03-11` | Block type rename: `transcription` → `meeting_notes`. Older versions still see `transcription`. |
| `2026-04-01` | Standard rate-limit response headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) on every response. AI completion endpoints GA. Markdown API for blocks GA. |

## Compatibility guarantees

- **Adding fields** to responses: minor; same version string.
- **Removing fields**: major; new version string.
- **Changing field semantics**: major; new version string.
- **Renaming fields or block/property types**: major; old name continues to surface in the prior version.
- **Adding endpoints**: minor.
- **Changing required request fields**: major.

## Deprecation

When a new major version ships:

- The prior version is supported for **≥ 12 months**.
- `Sunset: <RFC 7231 date>` header on responses to versions within 90 days of removal.
- `Deprecation: true` header on every response to a version older than the current baseline.
- A `Link: <https://developers...>; rel="deprecation"` header points at the migration guide.

## Multi-version SDK pattern

The first-party SDK (`packages/sdk`) supports multiple `notionVersion` values simultaneously, mirroring the official `@notionhq/client` pattern:

```ts
const client = new NotionClient({
  auth: 'secret_...',
  notionVersion: '2026-04-01',  // optional; defaults to LATEST_VERSION
});

// or per-call override:
await client.databases.query({ database_id, filter }, { notionVersion: '2022-06-28' });
```

- Response types are generated **per version** via `tools/codegen/sdk-types.ts`, with `@deprecated` JSDoc markers on fields that change shape in a newer version.
- A single client process can hold sessions against different versions; the version is part of the request signature for caching and tracing.

## Default request constants

These mirror `@notionhq/client`. They are exported from `packages/sdk/src/constants.ts`:

```ts
export const DEFAULT_BASE_URL = 'https://api.notion.com';
export const DEFAULT_TIMEOUT_MS = 60_000;
export const DEFAULT_MAX_RETRIES = 2;
export const DEFAULT_INITIAL_RETRY_DELAY_MS = 1_000;
export const DEFAULT_MAX_RETRY_DELAY_MS = 60_000;
export const MIN_VIEW_COLUMN_WIDTH = 32;  // px; database view column min width
```

Retries use exponential backoff with jitter on 429 / 5xx; the SDK honours `Retry-After` when present.

## Source of truth

`packages/shared/src/version.ts` is the single point of truth. Every middleware, validator, and codegen step reads from it. A pre-commit lint rule (`packages/lint-rules/version-allowlist`) ensures no string-literal Notion-Version values appear elsewhere.

## Tests

- Contract tests run against every supported version; per-version snapshots are stored under `tests/contract/__fixtures__/v{date}/`.
- Migration tests assert that an object created under `2022-06-28` is retrievable (with appropriate field promotion / demotion) under every later version.
- Chaos: an unsupported `Notion-Version` (older than the minimum) returns 400 with `code: invalid_request` and an `unsupported_version` detail.