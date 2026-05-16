# Internal v3 API

Notion runs **two** APIs, not one:

| API | Surface | Auth | Audience |
|-----|---------|------|----------|
| Public REST | `api.notion.com/v1/*` | `Authorization: Bearer secret_…` + `Notion-Version` header | Third-party integrations and bots |
| Internal v3 | `www.notion.so/api/v3/*` | `token_v2` cookie | Notion's own web/desktop/mobile clients |

The public REST API is documented at `developers.notion.com/reference`. The v3 surface is **undocumented**, evolves continuously, and is the one our web client must speak to deliver sub-100 ms collaborative editing and per-block surgical updates.

This document specifies the v3 surface we will implement. Behavioural equivalence is the bar — byte-equivalence is documented where we have it, otherwise marked behavioural with the rationale.

## Reverse-engineered references (read first)

- [`jamalex/notion-py`](https://github.com/jamalex/notion-py) — Python wrapper around v3; the most readable map of the endpoints and the `RecordStore` / push-update model.
- [`kjk/notionapi`](https://github.com/kjk/notionapi) — Go wrapper; complementary endpoint coverage.
- [`NotionX/react-notion-x`](https://github.com/NotionX/react-notion-x) — React renderer consuming the v3 `recordMap` shape; `packages/notion-compat/readme.md` is the canonical block-by-block compatibility ledger against the public API.
- [`splitbee/react-notion`](https://github.com/splitbee/react-notion) — minimal `blockMap` renderer.

If `<NotionRenderer/>` from `react-notion-x` renders the replica's `recordMap` indistinguishably from a real notion.so page, **internal-API parity is real**.

## Endpoint catalogue

All endpoints are `POST` with a JSON body and a `cookie: token_v2=...; notion_user_id=...` header. CSRF: the client sends an additional `x-notion-active-user-header` and the standard `notion-client-version` header.

| Endpoint | Purpose | Notes |
|----------|---------|-------|
| `loadPageChunk` | Read a page's blocks + descendants up to a depth/cursor | Returns a `recordMap` |
| `getRecordValues` | Fetch a list of records by `(table, id)` | Returns a `recordMap` |
| `syncRecordValues` | Refresh a list of records since a `version` | For background polling |
| `queryCollection` / `queryCollectionV2` | Query a database (collection) with a `collectionView` config | Filter / sort / group / aggregations |
| `submitTransaction` | Write — every edit is a list of `operations` against `(table, id, path)` | The single write endpoint |
| `getPublicPageData` | Public page metadata (no auth) | Used by published / shared-link pages |
| `getSubscriptionData` | Long-poll for live updates | Replaced by WebSocket on newer clients |
| `enqueueTask` | Server-side task (export, duplicate, indexing) | Returns a `taskId` |
| `getTasks` | Poll task status | |
| `loadUserContent` | Bootstrap the workspace tree on app open | |
| `searchPagesWithParent` | Quick-switcher search | |
| `loadCachedPageChunk` | Edge-cached page chunk for public renders | |
| `loadBlockSubtree` | Same shape as `loadPageChunk` but rooted at a block | |
| `getJoinableSpaces` / `getSpaces` | Workspace listing | |

## Core shapes

### `recordMap`

The single canonical wire format. Every read endpoint returns a `recordMap` that the client merges into a local `RecordStore`.

```jsonc
{
  "block": {
    "<block-id>": {
      "role": "reader" | "comment_only" | "read_and_write" | "editor",
      "value": { "id":"...", "type":"...", "version": 42, "parent_id":"...", "parent_table":"block|space|collection", "alive": true, "format": { ... }, "properties": { /* type-specific */ }, "content": [ "<child-id>", ... ], "created_by_id":"...", "last_edited_by_id":"...", "created_time": 1747339853000, "last_edited_time": 1747339853001, "space_id":"..." }
    }
  },
  "space":      { "<id>": { "role":..., "value":{ ... } } },
  "collection": { "<id>": { "role":..., "value":{ ... } } },
  "collection_view": { "<id>": { "role":..., "value":{ ... } } },
  "notion_user": { "<id>": { "role":..., "value":{ ... } } },
  "discussion": { ... },
  "comment":    { ... }
}
```

Notes:

- `version` is per-record, monotonically increasing. Client uses it for last-write-wins on conflict.
- `properties` for a text-bearing block is a `{ "title": [ /* rich text segments */ ] }` map where the segment array is the v3 inline format (positional, not the public v1 object format).
- `format` carries `block_color`, `block_width`, `block_height`, `block_full_width`, etc.
- `parent_table` describes which side-table the parent lives in. `block | space | collection | collection_view | team`.

### Inline rich-text segments

v3 inline text uses a positional array, not the public v1 object format:

```
["string", [ ["a","mark"], ["c","red"], ["b"], ["i"] ]]
```

Where the second element is a list of marks: `[markType, ...args]`. Mark types include:

| Mark | Args | Meaning |
|------|------|---------|
| `b` | — | Bold |
| `i` | — | Italic |
| `c` | — | Code |
| `s` | — | Strikethrough |
| `_` | — | Underline |
| `h` | `color` | Highlight / text color (one of the 9-color palette + 9 backgrounds) |
| `a` | `url` | Link |
| `u` | `userId` | User mention |
| `p` | `pageId` | Page mention |
| `d` | `dateObj` | Date mention |
| `e` | `latex` | Inline equation |
| `eoi` | `linkId` | External object instance (link previews) |
| `m` | `discussionId` | Anchored comment |

`packages/shared/src/v3-inline.ts` translates between v3 positional segments and v1 rich-text objects.

### `submitTransaction` operations

Every edit — typing, formatting, dragging, dropping, archiving, restoring — is one `transaction` carrying an array of `operations`:

```jsonc
{
  "requestId": "uuid",
  "transactions": [
    {
      "id": "tx-uuid",
      "spaceId": "uuid",
      "debug": { ... },
      "operations": [
        { "id":"<record-id>", "table":"block", "path":["properties","title"], "command":"set", "args": ["Hello",[["b"]]] },
        { "id":"<record-id>", "table":"block", "path":["last_edited_time"], "command":"set", "args": 1747339853001 },
        { "id":"<child-id>", "table":"block", "path":[], "command":"update", "args": { "type":"text", "properties":{...}, "parent_id":"<parent>", "parent_table":"block" } },
        { "id":"<parent-id>", "table":"block", "path":["content"], "command":"listAfter", "args": { "after":"<sibling>", "id":"<child-id>" } },
        { "id":"<id>", "table":"block", "path":["alive"], "command":"set", "args": false }   // archive
      ]
    }
  ]
}
```

Command vocabulary:

| Command | Effect |
|---------|--------|
| `set` | Overwrite the value at `path` |
| `update` | Deep-merge an object at `path` |
| `listAfter` | Insert `args.id` into the list at `path`, after `args.after` |
| `listBefore` | Insert before `args.before` |
| `listRemove` | Remove `args.id` from the list at `path` |
| `setPermissionItem` | Mutate ACL entries |

Order matters: operations within a transaction apply in array order; transactions within a request are atomic on the server.

## Auth

- `token_v2` cookie: `Set-Cookie: token_v2=<opaque>; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=...`
- Issued on `/v3/loginWithEmail` / `/v3/loginWithGoogle` etc.
- Refreshed silently via `/v3/getRecordValues` heartbeat when within 7 days of expiry.
- Parallel to (not replacement for) the public REST bearer tokens — the bearer goes through `api.notion.com/v1`.

## Long-poll / live updates

Two mechanisms over time:

1. Legacy: `/v3/getPublicPageData` long-polled every 5 s with `clientVersion` as the cursor; server flushes when a record changes.
2. Modern: WebSocket `wss://www.notion.so/v1/observation` carrying a stream of `{ records: { table, id, version } }` notifications. The client then calls `getRecordValues` for the changed IDs.

The replica implements both; the modern WS is the default and the long-poll is the fallback for restricted networks.

## Server implementation

| Concern | Where |
|---------|-------|
| Endpoint routing | `apps/api/src/routes/internal-v3.ts` |
| Operation executor | `packages/db/src/v3-ops/<command>.ts` |
| `recordMap` builder | `packages/db/src/v3-record-map.ts` |
| Inline format codec | `packages/shared/src/v3-inline.ts` |
| Cookie-auth middleware | `apps/api/src/middleware/cookie-auth.ts` |
| Long-poll & WS observation | `apps/api/src/ws/observation.ts` |

## Mapping to the relational schema

- `block` records project to the `blocks` table; `properties` (a JSON object) and `format` round-trip via `content` jsonb.
- `space` ↔ `workspaces`.
- `collection` ↔ `databases`. `collection_view` ↔ `database_views`.
- `notion_user` ↔ `users`.
- `discussion` / `comment` ↔ existing tables.

The same edit can arrive over either the public v1 endpoint or as a `submitTransaction` operation — both feed the same write path via the shared service layer. The service layer normalises both inputs to one internal command list.

## Honest scope

We aim for **behavioural** equivalence on v3, not byte-equivalence:

- `recordMap` shape: matches the documented union closely enough that `<NotionRenderer/>` from `react-notion-x` renders our output indistinguishably from a real Notion page. This is the conformance test.
- `submitTransaction` operations: round-trip the same edits with the same observable result on `recordMap` reads.
- Long-poll cadence: within ±200 ms of Notion's empirical interval.

We do **not** promise byte-equivalent message bodies because the v3 surface mutates with every Notion release. The `tests/v3-parity/` suite asserts behavioural equivalence and flags drift for triage; it does **not** treat byte mismatches as automatic failures.

## Tests

- Unit: inline-format codec round-trips every annotation combination.
- Integration: every `submitTransaction` command produces the expected SQL.
- Conformance: `tests/v3-parity/` runs `<NotionRenderer/>` over the replica's `recordMap` and snapshots the rendered DOM; compared against a snapshot rendered from a real notion.so page (anonymised, with our screenshot-usage policy).
- Chaos: malformed transactions (mismatched table, off-by-one `version`, `set` on a non-existent path) all return clean 4xx with structured logs.
- Observability: every transaction emits an `v3.submitTransaction` span with `ops.count` and `space.id`; every `recordMap` build emits a `v3.recordMap.build` span with the included record counts.