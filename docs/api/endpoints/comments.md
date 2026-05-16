# Comments Endpoints

## `POST /v1/comments`

Create a comment. Two modes:

**On a page** (creates a new discussion):

```jsonc
{
  "parent": { "page_id": "uuid" },
  "rich_text": [ /* RichText[] */ ]
}
```

**On an existing discussion** (reply):

```jsonc
{
  "discussion_id": "uuid",
  "rich_text": [...]
}
```

**Response** (200):

```jsonc
{
  "object": "comment",
  "id": "uuid",
  "parent": { "type":"page_id"|"block_id", ... },
  "discussion_id": "uuid",
  "created_time": "...",
  "last_edited_time": "...",
  "created_by": { "object":"user","id":"..." },
  "rich_text": [...]
}
```

## `GET /v1/comments`

List open comments on a page or block.

**Query**:
- Exactly one resource selector (required):
  - `block_id=<uuid>` — comments anchored to a block (including the page's root block, i.e. the page itself)
  - `page_id=<uuid>` — equivalent to `block_id` for the page's root; supported for ergonomic parity with `/v1/pages`
- Pagination (optional): `start_cursor`, `page_size`

Omitting both selectors returns 400 `invalid_request`. Providing both returns 400.

**Response** (200):

```jsonc
{ "object":"list", "type":"comment", "results":[ /* Comment[] */ ], "next_cursor":"...|null", "has_more":..., "comment":{} }
```

## Test obligations

- Contract: create on page, reply, list, paginate.
- SDK-progressive: `client.comments.create`, `.list`.
- Chaos: comment on resource without comment permission → 403/404; oversized rich_text → 400; XSS in URL/href → sanitised.