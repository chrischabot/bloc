# First-Party SDK

`packages/sdk` ships a TypeScript SDK whose surface and shape mirror the official `@notionhq/client`. The conformance bar is: the official client, pointed at our base URL with one of our integration tokens, drives every operation against our server with no behavioural differences. The `tests/sdk-progressive/` suite enforces this — see `docs/testing/05-sdk-progressive-tests.md`.

## Why a first-party SDK in addition to the official one

- We dogfood it inside `apps/web` (the frontend) and inside our own backend tests, so we own its DX.
- It exposes our extensions cleanly (e.g. `client.dataSources.*`, `client.ai.*`, `client.buttons.*`, `client.webhooks.*`) without forking the official client.
- It is generated from the same Zod schemas in `packages/shared` that the API server validates against, eliminating drift.

The official client remains the byte-equivalence conformance test. Our SDK is **not** a substitute — both are supported.

## Package layout

```
packages/sdk/
├── src/
│   ├── client.ts                // Notion class — top-level
│   ├── http/
│   │   ├── transport.ts         // undici-based fetcher
│   │   ├── retry.ts             // exponential backoff + jitter
│   │   ├── errors.ts            // typed error classes
│   │   └── tracing.ts           // outbound traceparent injection
│   ├── constants.ts             // DEFAULT_* exports
│   ├── namespaces/
│   │   ├── blocks.ts
│   │   ├── pages.ts
│   │   ├── databases.ts
│   │   ├── data-sources.ts
│   │   ├── users.ts
│   │   ├── comments.ts
│   │   ├── search.ts
│   │   ├── ai.ts
│   │   ├── automations.ts
│   │   ├── buttons.ts
│   │   ├── forms.ts
│   │   ├── webhooks.ts
│   │   ├── templates.ts
│   │   ├── calendar.ts
│   │   ├── sync.ts
│   │   └── sites.ts
│   └── index.ts
├── tests/                       // SDK-local unit tests
├── package.json
└── README.md
```

## Public surface

```ts
import { Notion } from '@our/sdk';

const client = new Notion({
  auth: 'secret_xxx',                          // bearer token; or `cookieJar` for v3
  baseUrl: 'https://api.our-domain',           // default DEFAULT_BASE_URL
  notionVersion: '2026-04-01',                 // default LATEST_VERSION
  timeoutMs: 60_000,                           // default DEFAULT_TIMEOUT_MS
  maxRetries: 2,                               // default DEFAULT_MAX_RETRIES
  initialRetryDelayMs: 1_000,                  // default DEFAULT_INITIAL_RETRY_DELAY_MS
  maxRetryDelayMs: 60_000,                     // default DEFAULT_MAX_RETRY_DELAY_MS
  fetch: globalThis.fetch,                     // injectable for tests
  logger: undefined,                           // optional pino-compatible
});

// Every namespace mirrors @notionhq/client + extensions
await client.blocks.retrieve({ block_id });
await client.blocks.children.list({ block_id, page_size: 50 });
await client.blocks.children.append({ block_id, children: [...] });
await client.blocks.update({ block_id, ... });
await client.blocks.delete({ block_id });

await client.pages.create({ parent: { data_source_id }, properties: {...} });
await client.pages.retrieve({ page_id });
await client.pages.update({ page_id, ... });
await client.pages.properties.retrieve({ page_id, property_id });

await client.databases.create({ ... });
await client.databases.retrieve({ database_id });
await client.databases.update({ database_id, ... });
await client.databases.query({ database_id, filter, sorts });   // legacy; routes to default source

await client.dataSources.create({ database_id, name });
await client.dataSources.retrieve({ data_source_id });
await client.dataSources.update({ data_source_id, ... });
await client.dataSources.query({ data_source_id, filter, sorts });
await client.dataSources.delete({ data_source_id });

await client.users.me();
await client.users.retrieve({ user_id });
await client.users.list({ page_size: 50 });

await client.comments.create({ parent: { page_id }, rich_text });
await client.comments.list({ block_id });

await client.search({ query, filter });

// Extensions
await client.ai.completions({ surface: 'writer', messages });
await client.ai.qa({ query });
await client.ai.agent.tasks.create({ user_message });
await client.ai.autofill.run({ page_id, property_id });

await client.automations.list({ database_id });
await client.automations.create({ database_id, trigger, steps });
await client.automations.update({ automation_id, ... });
await client.automations.delete({ automation_id });
await client.automations.runs.list({ automation_id });
await client.automations.runs.test({ automation_id, sample_page_id });

await client.buttons.invoke({ block_id, context });

await client.forms.submissions.list({ view_id });

await client.templates.list({ category, q });
await client.templates.duplicate({ template_id, workspace_id, parent });

await client.calendar.events.list({ from, to, sources });
await client.calendar.events.create({ source_id, title, start, end });

await client.webhooks.create({ endpoint_url, subscribed_events });
await client.webhooks.list();
await client.webhooks.delete({ webhook_id });
await client.webhooks.deliveries.list({ webhook_id });
await client.webhooks.ping({ webhook_id });

await client.sites.publication.get({ page_id });
await client.sites.publication.create({ page_id, ... });
await client.sites.publication.delete({ page_id });
await client.sites.customDomains.list({ workspace_id });

await client.sync.bindings.create({ database_id, source, config, field_map });
await client.sync.runs.list({ binding_id });
```

## Default constants

`packages/sdk/src/constants.ts` (importable for testing / overriding):

```ts
export const DEFAULT_BASE_URL = 'https://api.notion.com';
export const DEFAULT_TIMEOUT_MS = 60_000;
export const DEFAULT_MAX_RETRIES = 2;
export const DEFAULT_INITIAL_RETRY_DELAY_MS = 1_000;
export const DEFAULT_MAX_RETRY_DELAY_MS = 60_000;
export const MIN_VIEW_COLUMN_WIDTH = 32;        // px
```

These match `@notionhq/client`'s defaults exactly.

## Multi-version handling

```ts
// Client-wide default
const client = new Notion({ auth, notionVersion: '2026-04-01' });

// Per-call override
const legacyResponse = await client.databases.query(
  { database_id, filter },
  { notionVersion: '2022-06-28' }
);
```

Type emission:

- For every endpoint, `tools/codegen/sdk-types.ts` emits one TypeScript type per supported version.
- A `versioned<T, V>` mapped type selects the right shape per call site.
- Fields removed in a later version are marked `@deprecated` in earlier types with a JSDoc note pointing at the migration path.

## Retry / backoff

- 429 with `Retry-After`: wait `Retry-After` seconds, then retry; counts against `maxRetries`.
- 429 without `Retry-After`: exponential backoff with full jitter, `min(initial * 2^attempt, max)`.
- 5xx (502 / 503 / 504): retried with the same backoff.
- Other 5xx (500): **not** retried by default. The caller can pass `retryOn5xx: true`.
- 4xx other than 429: never retried.
- Network errors (DNS, TCP, TLS): retried.

## Errors

Every non-2xx is thrown as a typed error:

```ts
import { NotionAPIError, NotionRateLimitError, NotionRequestTimeoutError, NotionAuthError } from '@our/sdk';

try {
  await client.pages.retrieve({ page_id });
} catch (err) {
  if (err instanceof NotionRateLimitError) {
    // err.retryAfterSec, err.rateLimit
  }
}
```

Every error carries `code`, `status`, `requestId`, `details`. The `requestId` is the same string the server logs — invaluable in production support.

## Authentication

Three modes:

1. `auth: 'secret_...'` — bearer token. Sent as `Authorization: Bearer secret_...`.
2. `cookieJar: jar` — session cookie. Used by the web frontend and the v3 surface.
3. `oauth: { clientId, clientSecret }` — for the OAuth code-exchange and refresh flows.

Mixed in one process: a single SDK instance can hold only one auth mode at a time; tests instantiate multiple clients side-by-side.

## Observability

- The SDK injects `traceparent` on every outbound request when an OpenTelemetry context is active in the caller.
- It does **not** create its own spans — instrumentation is the responsibility of the caller. The server emits a span per request anyway, and the trace links via `traceparent`.
- A `logger` (pino-compatible) can be attached; debug logs are emitted at the `debug` level only.

## Bundling

- ESM-first; CJS fallback emitted by tsup.
- `package.json` `"exports"` map exposes each namespace as a sub-path import for tree-shaking: `@our/sdk/blocks`, `@our/sdk/databases`, etc.
- Zero runtime deps other than `undici` (Node ≥ 22 has it built-in; the bundle uses native `fetch` when available).

## Tests

- Unit: every namespace function (request shape + response parser) — Vitest.
- SDK-progressive: matrix in `tests/sdk-progressive/matrix.ts` (see `docs/testing/05-sdk-progressive-tests.md`).
- Type test: `tsd` assertions in `packages/sdk/tests/type/` ensure every emitted type matches the Zod schema in `packages/shared`.

## Codegen pipeline

`tools/codegen/sdk-types.ts` runs in CI and during `pnpm build:sdk`. Inputs: the Zod schemas in `packages/shared/`. Outputs: per-version type files under `packages/sdk/src/types/v{date}/`. The namespace files import the latest version's types by default; per-call overrides use the older versions.

## README quickstart

`packages/sdk/README.md` ships with three quickstarts:

1. Bearer-token bot creating a page in a database.
2. Webhook receiver: verify signature, parse the event, follow up with a `pages.retrieve`.
3. Cookie-jar v3 client driving `<NotionRenderer/>` for a local preview of a workspace.