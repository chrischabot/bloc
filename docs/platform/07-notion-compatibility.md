# Compatibility with Notion

Bloc is built to be a drop-in replacement for the Notion API where that's meaningful, and behaviourally equivalent where byte-parity isn't (and shouldn't be) the point.

## Calibration

| Surface | Target | How it's enforced |
|---|---|---|
| **Public REST API** (`/v1/*`) | **Byte-equivalent** | The official `@notionhq/client` runs unmodified against Bloc. The progressive SDK conformance suite under [`tests/sdk-progressive/`](../../tests/sdk-progressive/) exercises every endpoint the official SDK calls. |
| **Public webhooks** | **Byte-equivalent** within the documented event catalogue | The catalogue is exhaustive; events outside it (user changes, workspace-settings churn) are deliberately not delivered. |
| **Internal v3 API** (`/api/v3/*`) | **Behavioural-equivalent** | `<NotionRenderer/>` from `react-notion-x` renders our `recordMap` indistinguishably from notion.so. We don't promise byte parity because the surface mutates with every Notion release. |
| **Sync protocol** | **Behavioural-equivalent** | Two-tab convergence test, offline-replay test, 50-editor load test. Wire format is our own. |
| **UI** | **Pixel-equivalent** within the screenshot corpus | Visual regression vs `reference/screenshots/`. Surfaces with no captured reference are inferential. |
| **AI surfaces** | **Shape-equivalent** | Same endpoints, same citation format, same Custom-Agent trigger model. Answer quality depends on your LLM provider — not a parity target. |

## Using `@notionhq/client` against Bloc

```ts
import { Client } from '@notionhq/client';

const notion = new Client({
  auth: process.env.BLOC_TOKEN,
  baseUrl: 'http://localhost:3001',
});

const page = await notion.pages.create({ /* … */ });
const search = await notion.search({ query: 'Hello' });
```

Everything the official SDK does works:

- `pages.create / retrieve / update`
- `blocks.retrieve / update / delete`, `blocks.children.list / append`
- `databases.create / retrieve / update / query`
- `users.list / retrieve / me`
- `comments.create / list`
- `search`
- OAuth helpers

## Known compatibility deltas

A short list of places where Bloc deliberately differs:

- **Versioning** — Bloc advertises the latest `Notion-Version` that has shipped; older versions are accepted but coerced to the latest behaviour. There is no "old version of the response" emulation.
- **Page archive vs delete** — `DELETE /v1/pages/{id}` archives; pass `?permanent=true` to drop. The official SDK doesn't expose this query parameter; the Bloc SDK does.
- **Data sources** — Bloc surfaces the data-sources primitive at `/v1/databases/{id}/data_sources` and `/v1/data_sources/{id}`. The official SDK doesn't include it yet.
- **AI / Charts / Reminders / Automations / Forms / Sites / Inbox / Versions / Permissions / Audit** — Bloc exposes these as first-class `/v1/*` resources; they're not in the public Notion API. The Bloc SDK includes them as additional namespaces.
- **`recordMap` shape** at `/api/v3/*` tracks `react-notion-x`. If you're hitting that surface, pin your `react-notion-x` version and run the conformance test from `tests/contract/internal-v3/` before upgrading.

## When in doubt

If a behaviour appears identical to Notion's public docs but is undocumented in our spec, treat ours as authoritative for Bloc — but please open an issue. If a behaviour conflicts with `developers.notion.com/reference`, that's a bug; the public doc wins and Bloc should be patched.
