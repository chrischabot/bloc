# APIs at a glance

Bloc exposes three surfaces. Pick the one that matches what you're doing.

## `/v1/*` — public REST API

This is what almost everyone wants. It's wire-compatible with `api.notion.com/v1`, so:

- `@notionhq/client` works against your Bloc server unmodified — just point `baseUrl` at it.
- Existing scripts, Zapier-style integrations, and SDK code keep working.
- The error envelope, pagination shape, and `notion-version` header semantics are the same.

Authentication: `Authorization: Bearer <token>` plus `Notion-Version: <date>` (defaults to the latest version Bloc knows about).

Full reference: [API reference](../api/README.md).

## `/api/v3/*` — internal recordMap API

The internal v3 endpoints (`loadPageChunk`, `getRecordValues`, `syncRecordValues`, `submitTransaction`, `loadUserContent`, `queryCollection`, `queryCollectionV2`) emit a `recordMap` shape that `<NotionRenderer/>` from [`react-notion-x`](https://github.com/NotionX/react-notion-x) consumes directly. Use this when you want to render a Bloc page in the same component you'd use to render a public notion.so page.

Same auth as `/v1/*` (Bearer token).

Not byte-for-byte stable. We aim for *behavioural* equivalence — the renderer reproduces the page faithfully — and update the shape when `react-notion-x` requires it.

Full reference: [API › Internal v3](../api/14-internal-v3.md).

## WebSocket realtime — `/v1/realtime/ws`

Long-lived connection for live updates: block edits propagating across tabs, presence, comment notifications. The wire format is documented (see [Realtime & sync](./06-realtime-and-sync.md)) but is internal — only the SDK is a supported client. The web app uses it under the hood; you usually don't talk to it directly.

## Webhooks

Outbound HTTP. Subscribe with `POST /v1/webhooks`; Bloc signs each delivery with HMAC-SHA256 over the body using a per-webhook secret. See [API › Webhooks](../api/13-webhooks.md).

## How they relate

- `/v1` is the **API as a contract**: stable, public, documented.
- `/api/v3` is the **API as data source for a renderer**: tracks `react-notion-x`, not a stable public contract.
- WebSocket is the **API as a live channel**.
- Webhooks are the **API as a fan-out**: Bloc tells you when something happens.

Most integration work happens against `/v1`. Reach for `/api/v3` only if you're embedding `<NotionRenderer/>`.
