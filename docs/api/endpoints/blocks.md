# Blocks

Endpoints under `/v1/blocks`.

## Retrieve a block

`GET /v1/blocks/{block_id}`

Returns the block. The `[type]` key on the response carries the type-specific payload.

## Update a block

`PATCH /v1/blocks/{block_id}`

The body contains the type-specific payload to overwrite, plus optional `archived` / `in_trash`. For a paragraph:

```json
{ "paragraph": { "rich_text": [{ "type": "text", "text": { "content": "..." } }] } }
```

Partial updates only overwrite the keys you supply within the type payload — they don't deep-merge nested arrays. To clear an array, pass `[]`.

## Delete a block

`DELETE /v1/blocks/{block_id}`

Soft-archives. Permanent removal happens via the 30-day trash sweep.

## List children of a block

`GET /v1/blocks/{block_id}/children?page_size=…&start_cursor=…`

Returns a paginated list of immediate children, in document order. Children of children require a recursive call.

## Append children

`PATCH /v1/blocks/{block_id}/children`

```json
{
  "children": [
    { "type": "paragraph", "paragraph": { "rich_text": [{ "type": "text", "text": { "content": "..." } }] } },
    { "type": "heading_2", "heading_2": { "rich_text": [{ "type": "text", "text": { "content": "Title" } }] } }
  ],
  "after": "block_id_to_insert_after"  // optional
}
```

If `after` is omitted, children are appended to the end. If supplied, children are inserted directly after the given sibling (must be a child of `block_id`).

Returns the updated child list (post-append).

## Block types

The `type` discriminator gates the shape of the payload. The 38 supported types are documented in [Block types schema](../schemas/block-types.md).
