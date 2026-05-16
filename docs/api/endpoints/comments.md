# Comments

Endpoints under `/v1/comments`.

## Create a comment

`POST /v1/comments`

Two shapes:

**Start a new discussion on a page or block:**

```json
{
  "parent": { "page_id": "uuid" }   // or { "block_id": "uuid" }
  "rich_text": [ { "type": "text", "text": { "content": "..." } } ]
}
```

**Reply to an existing discussion:**

```json
{ "discussion_id": "uuid", "rich_text": [ ... ] }
```

## List comments

`GET /v1/comments?page_id={uuid}` or `?block_id={uuid}`

Returns comments on that target (any discussion), paginated.

## Reactions

`POST   /v1/comments/{comment_id}/reactions`

```json
{ "emoji": "👍" }
```

`DELETE /v1/comments/{comment_id}/reactions/{emoji}` (URL-encode the emoji)

The response is the updated comment with the `reactions` array.

## Resolve a discussion

`POST /v1/comments/{comment_id}/resolve`

Returns:

```json
{ "object": "discussion", "id": "uuid", "resolved": true }
```

Resolving a discussion does not delete its comments; it hides them by default in the UI.
