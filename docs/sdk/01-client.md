# Client construction

## `new Bloc(options)`

```ts
import { Bloc, ClientOptions } from '@bloc/sdk';

const bloc = new Bloc({ auth: process.env.BLOC_TOKEN! });
```

### `ClientOptions`

| Field | Type | Default | Notes |
|---|---|---|---|
| `auth` | `string` | — (required) | Bearer token. With or without the `Bearer ` prefix. |
| `baseUrl` | `string` | `https://api.notion.com` | Trailing slash trimmed automatically. Set this to your Bloc server. |
| `notionVersion` | `NotionVersion` | `LATEST_VERSION` from `@bloc/shared` | Override per-request via `client.request({ notionVersion: '...' })`. |
| `timeoutMs` | `number` | `60_000` | Per-request abort timeout. |
| `maxRetries` | `number` | `2` | Retried on 429 / 502 / 503 / 504. |
| `initialRetryDelayMs` | `number` | `1_000` | Exponential backoff starts here. |
| `maxRetryDelayMs` | `number` | `60_000` | Backoff cap. |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Inject a custom fetch (testing, instrumentation). |

The constructor wires up every namespace:

```ts
class Bloc {
  readonly client:        BlocClient;
  readonly blocks:        BlocksNamespace;
  readonly pages:         PagesNamespace;
  readonly databases:     DatabasesNamespace;
  readonly dataSources:   DataSourcesNamespace;
  readonly users:         UsersNamespace;
  readonly comments:      CommentsNamespace;
  readonly buttons:       ButtonsNamespace;
  readonly automations:   AutomationsNamespace;
  readonly charts:        ChartsNamespace;
  readonly webhooks:      WebhooksNamespace;
  readonly inbox:         InboxNamespace;
  readonly ai:            AINamespace;
  readonly v3:            V3Namespace;
  readonly reminders:     RemindersNamespace;
  readonly analytics:     AnalyticsNamespace;
  readonly versions:      VersionsNamespace;
  readonly permissions:   PermissionsNamespace;

  search(args?: SearchArgs): Promise<SearchResponse>;
}
```

## `BlocClient` (low-level transport)

If you need a request shape not yet exposed by a namespace, use the underlying client:

```ts
const result = await bloc.client.request<MyResponse>({
  method: 'POST',
  path: '/v1/some/path',
  body:  { ... },
  query: { ... },
  notionVersion: '2025-09-03',
});
```

### `RequestArgs<TBody>`

| Field | Type | Notes |
|---|---|---|
| `method` | `'GET' \| 'POST' \| 'PATCH' \| 'DELETE'` | |
| `path` | `string` | Includes leading slash, e.g. `/v1/pages/...` |
| `body` | `TBody` | Stringified as JSON. Omit for GET/DELETE without a body. |
| `query` | `Record<string, string \| number \| boolean \| undefined>` | `undefined` values are skipped. |
| `notionVersion` | `NotionVersion` | Overrides the client default for this call. |

`request` returns the parsed JSON body. On 204 it resolves to `undefined`.

## Retries

Built into `BlocClient`:

- 429 and 5xx (502/503/504) trigger a retry up to `maxRetries`.
- `Retry-After` is honoured if present (otherwise exponential backoff with jitter).
- Network errors (DNS, ECONNRESET, timeout) trigger a retry within the same budget.

Once retries are exhausted, the original error is re-thrown.

## Authorization header

The SDK normalises `auth` — passing `"abc"` produces `Authorization: Bearer abc`; passing `"Bearer abc"` produces the same. Don't include the word `Bearer` and a trailing space if you're storing tokens — store just the opaque part.

## Notion-Version header

Sent on every request from `client.notionVersion`. Override per-call via the `notionVersion` field on `RequestArgs` or by passing `notionVersion` into individual namespace methods that accept it.

## Custom fetch

Useful for:

- **Tracing** — wrap fetch to emit a span per request.
- **Testing** — pass a mock that returns canned responses.
- **Proxy** — route through a corporate proxy.

```ts
const bloc = new Bloc({
  auth, baseUrl,
  fetch: async (url, init) => {
    const span = tracer.startSpan('http.client');
    try {
      return await globalThis.fetch(url, init);
    } finally {
      span.end();
    }
  }
});
```
