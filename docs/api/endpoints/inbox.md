# Inbox

The inbox surfaces mentions, comment replies, and page-update notifications for the caller.

## List

`GET /v1/inbox?kind=all&since=…&page_size=50`

| Query param | Values |
|---|---|
| `kind` | `all` (default), `mention`, `comment`, `page_update` |
| `since` | ISO 8601 cutoff |
| `page_size` | 1–100, default 50 |

Response:

```json
{
  "object": "list",
  "type": "inbox_entry",
  "results": [
    {
      "object": "inbox_entry",
      "id": "uuid",
      "kind": "mention" | "comment" | "page_update",
      "actor_user_id": "uuid" | null,
      "target_page_id": "uuid",
      "snippet": "...",
      "created_at": "..."
    }
  ],
  "next_cursor": "..." | null,
  "has_more": true | false
}
```

Inbox entries are not deletable via the public API in v1 — they age out via the worker's retention sweep (90 days default).
