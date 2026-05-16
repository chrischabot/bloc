# Internal v3 API

The `/api/v3/*` endpoints emit a `recordMap` shape compatible with `<NotionRenderer/>` from [`react-notion-x`](https://github.com/NotionX/react-notion-x). Use these to render a Bloc page in the same component you'd use to render a public notion.so page.

This is **not** a stable public contract. Bloc tracks `react-notion-x`'s expectations; the shape evolves.

All endpoints require auth (Bearer or `token_v2` session cookie).

## Load page chunk

`POST /api/v3/loadPageChunk`

```json
{ "pageId": "uuid", "limit": 100, "chunkNumber": 0 }
```

Response:

```json
{
  "recordMap": {
    "block":           { "<id>": { "role": "...", "value": { ... } } },
    "space":           { ... },
    "collection":      { ... },
    "collection_view": { ... },
    "notion_user":     { ... },
    "discussion":      { ... },
    "comment":         { ... }
  },
  "cursor": { "stack": [ ... ] }
}
```

To load the next chunk, send the returned `cursor.stack`. Done when the stack is empty.

## Get record values

`POST /api/v3/getRecordValues`

```json
{
  "requests": [
    { "table": "block",      "id": "uuid" },
    { "table": "collection", "id": "uuid" }
  ]
}
```

Response:

```json
{
  "results": [
    { "role": "reader", "value": { ... } } | null
  ]
}
```

## Sync record values

`POST /api/v3/syncRecordValues`

```json
{
  "requests": [
    { "pointer": { "table": "block", "id": "uuid" }, "version": 42 }
  ]
}
```

Returns a `recordMap` containing only records whose version has advanced beyond the supplied `version`. Useful for delta-fetching.

## Submit transaction

`POST /api/v3/submitTransaction`

Bulk mutation. The body is a transaction graph; each operation has a table, path, command, and args.

```json
{
  "requestId": "uuid",
  "transactions": [
    {
      "id": "uuid",
      "spaceId": "uuid",
      "operations": [
        { "id": "uuid", "table": "block", "path": ["properties", "title"], "command": "set", "args": [["new title"]] }
      ]
    }
  ]
}
```

Commands: `set`, `update`, `listAfter`, `listBefore`, `listRemove`.

Response:

```json
{ "object": "transaction_result", "applied": 1, "skipped": 0 }
```

## Load user content

`POST /api/v3/loadUserContent`

Returns the current user's bootstrap content (workspaces, recent pages). Body `{}`.

## Query collection

`POST /api/v3/queryCollection`

```json
{
  "collection":     { "id": "uuid" },
  "collectionView": { "id": "uuid" },
  "loader": {
    "type": "table",
    "limit": 50,
    "searchQuery": "...",
    "filter": { ... },
    "sort":   [ ... ]
  }
}
```

Response:

```json
{
  "recordMap": { ... },
  "result": {
    "type": "table",
    "blockIds": [ "uuid", "uuid" ],
    "total": 142,
    "reducerResults":     { "Status": { "Done": 12, "In Progress": 3 } },
    "aggregationResults": [ ... ],
    "sizeHint": 142
  }
}
```

## Query collection v2

`POST /api/v3/queryCollectionV2` — same body, slightly different response. The Bloc serialiser returns the same shape; the SDK calls v2 by default.

## Compatibility note

The renderer expects specific records to be present in the `recordMap` for given block types (e.g. `notion_user` for the author bubble). The Bloc serialiser populates these reactively — calling `loadPageChunk` returns everything `<NotionRenderer/>` needs.

If you upgrade `react-notion-x`, run `tests/contract/internal-v3/` against your Bloc server first.
