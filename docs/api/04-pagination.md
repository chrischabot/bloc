# Pagination

Every list-returning endpoint uses the same cursor protocol.

## Shape

```json
{
  "object": "list",
  "type": "page",
  "results": [...],
  "next_cursor": "abcd..." | null,
  "has_more": true | false
}
```

- `results` — the page of items.
- `next_cursor` — opaque cursor. Pass back to get the next page. `null` if there are no more results.
- `has_more` — convenience; `next_cursor === null` is equivalent.

## Page size

Pass `page_size` (1–100, default 100) on the request. Servers may return fewer results than requested even when more exist — always check `has_more`.

`GET` endpoints take `page_size` and `start_cursor` as **query parameters**:

```
GET /v1/blocks/{block_id}/children?page_size=50&start_cursor=abcd…
```

`POST` endpoints that paginate (`search`, `databases.query`, `data_sources.query`) take them in the JSON body:

```json
{ "query": "Hello", "page_size": 50, "start_cursor": "abcd…" }
```

## Iterating

```ts
let cursor: string | undefined;
do {
  const page = await bloc.blocks.children.list({
    block_id,
    page_size: 100,
    start_cursor: cursor,
  });
  for (const block of page.results) process(block);
  cursor = page.has_more ? page.next_cursor! : undefined;
} while (cursor !== undefined);
```

## Cursor stability

Cursors are stable across the *current snapshot* of the result set, not across concurrent writes:

- New items added during iteration **may or may not** appear in subsequent pages.
- Deleted items **will not** appear, even if the cursor was issued before the delete.
- Cursors don't expire on a wall-clock timer, but a cursor older than 1 h on a busy collection may return stale paging boundaries — fall back to refetching from the start.

## Sort order

Default sort varies by endpoint:

- `blocks.children.list` — document order (preserves block tree)
- `databases.query` — DB schema default sort (defined on the database)
- `search` — relevance
- `users.list`, `comments.list` — `created_time desc`

Each endpoint's reference page documents what sort it uses and which `sorts:` array shapes it accepts.
