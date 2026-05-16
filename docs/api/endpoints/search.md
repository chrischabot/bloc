# Search

`POST /v1/search`

```json
{
  "query": "Hello",
  "filter": { "value": "page" | "database", "property": "object" },
  "sort":   { "direction": "ascending" | "descending", "timestamp": "last_edited_time" },
  "page_size": 50,
  "start_cursor": "..."
}
```

All fields optional. Empty query returns recent pages and databases (ordered by `last_edited_time desc` by default).

Response:

```json
{
  "object": "list",
  "type": "page_or_database",
  "results": [ /* mixed PageObject and DatabaseObject */ ],
  "next_cursor": "..." | null,
  "has_more": true | false
}
```

## Notes

- Search is backed by MeiliSearch. There's a small replication lag (typically < 5 s) between a write and its appearance in search results.
- Search results respect the caller's ACL — pages they can't read won't appear.
- The `query` is matched against title, body text, and database property values configured as searchable.
- See [Reporting › Metrics](../../reporting/03-metrics.md) for `search_index_lag_seconds`.
