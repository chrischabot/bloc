# Blocks Endpoints

## `GET /v1/blocks/{block_id}`

Retrieve a block by ID.

**Response** (200): `Block` object (see `docs/api/schemas/block-types.md`).

**Errors**: 401, 403, 404.

## `GET /v1/blocks/{block_id}/children`

Retrieve children of a block (or page — pages are blocks here).

**Query params**:
- `start_cursor` (string, optional)
- `page_size` (int, 1-100, default 100)

**Response** (200):

```jsonc
{
  "object": "list",
  "type": "block",
  "results": [ /* Block[] */ ],
  "next_cursor": "...|null",
  "has_more": true|false,
  "block": {}
}
```

**Notes**: ordering is by `position` ascending. Soft-archived blocks excluded by default.

## `PATCH /v1/blocks/{block_id}/children`

Append children to a block.

**Body**:

```jsonc
{
  "children": [
    { "object": "block", "type": "paragraph", "paragraph": { "rich_text": [...] } }
  ],
  "after": "<sibling-block-id>"  // optional; insert after this sibling, default end
}
```

**Constraints**:
- Up to 100 children per request.
- Total depth from root page ≤ 100 levels.
- Children's `type` must be allowed for the parent block type (see block-type table).

**Response** (200):

```jsonc
{
  "object": "list",
  "type": "block",
  "results": [ /* the appended Block[] */ ],
  "next_cursor": null,
  "has_more": false
}
```

## `PATCH /v1/blocks/{block_id}`

Update a block's content and/or archived state.

**Body**: partial update — provide only the type-specific payload and/or `archived`:

```jsonc
{
  "paragraph": { "rich_text": [...] },
  "archived": false
}
```

**Constraints**:
- The block's `type` is immutable. To change type, delete and recreate.
- This endpoint does **not** reparent a block. Block moves (changing `parent_id`) are exposed via a dedicated endpoint added in a follow-up phase: `PATCH /v1/blocks/{block_id}/move` with body `{ parent_id, after? }`. Until that ships, the editor performs a move client-side as a delete + re-create within a single transaction.

**Response** (200): updated `Block`.

## `DELETE /v1/blocks/{block_id}`

Archive a block.

**Response** (200): the archived `Block` with `archived: true`, `in_trash: true`.

**Notes**:
- Soft delete; recoverable from trash for 30 days.
- Cascades to children (they remain children of an archived parent and inherit visibility).

## Headers

All require `Authorization` and `Notion-Version`.

## Observability

Every endpoint emits a span named `blocks.<verb>` with attributes:
- `block.id`
- `block.type` (on retrieve/update/delete)
- `block.children_count` (on append/list)
- `workspace.id`
- `user.id`

## Test obligations

- Contract tests: per block type, exercise list/append/retrieve/update/delete.
- SDK-progressive: `client.blocks.children.list`, `.append`, `.update`, `.retrieve`, `.delete` byte-match Notion's SDK shape.
- Chaos: oversized children arrays (>100), oversized rich_text (>2000 chars), invalid type, type mismatch, cycle attempt (block referencing ancestor), permission denied — all clean 4xx.
- Benchmark: p99 retrieve < 80ms; p99 append (10 children) < 200ms; p99 list (100 children) < 100ms.