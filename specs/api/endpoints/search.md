# Search Endpoint

## `POST /v1/search`

Full-text search the workspace.

**Body**:

```jsonc
{
  "query": "string",
  "sort": { "direction": "ascending"|"descending", "timestamp": "last_edited_time" },
  "filter": { "value": "page" | "database", "property": "object" },
  "start_cursor": "...",
  "page_size": 100
}
```

All fields optional. Empty `query` returns recently edited objects.

**Response** (200):

```jsonc
{
  "object": "list",
  "type": "page_or_database",
  "results": [ /* Page or Database objects */ ],
  "next_cursor": "...|null",
  "has_more": true|false,
  "page_or_database": {}
}
```

## Semantics

- Search index: MeiliSearch with documents per page (`title`, `text` derived from blocks), per database (`title`, `description`).
- Server-side ACL filter applied to every result; results the caller cannot read are removed (and `has_more` may indicate further results).
- Typo-tolerance: 1 typo per word ≤ 4 chars, 2 typos for longer words. Configured in MeiliSearch.
- Ranking: token-position + recency boost (last_edited_time half-life 30d).

## Test obligations

- Contract: results match Notion's ordering rules (recency for empty query, relevance for non-empty).
- SDK-progressive: `client.search`.
- Chaos: extremely long queries (10k chars), regex-y queries, queries with control chars — all 200 (sanitised) or 400 (over length).
- Latency: indexer lag asserted ≤ 5s after write.