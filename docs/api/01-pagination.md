# Pagination

## Request parameters

| Param | Type | Default | Max | Notes |
|-------|------|---------|-----|-------|
| `start_cursor` | string | — | — | opaque; omit for the first page |
| `page_size` | integer | 100 | 100 | minimum 1; 0 / negative / > 100 → 400 |

## Response

```jsonc
{
  "object": "list",
  "results": [...],
  "next_cursor": "string | null",
  "has_more": true | false
}
```

- `has_more = true` ⇔ `next_cursor != null`.
- `has_more = false` ⇒ `next_cursor` is `null`.
- An invalid / expired cursor returns `400 invalid_request` with `"code": "invalid_cursor"`.

## Cursor encoding (internal)

- The cursor is `base64url(JSON.stringify({ k: <opaque-payload>, v: 1 }))` where `<opaque-payload>` is endpoint-specific:
  - block children: `{ position: "<frac-index>", id: "<uuid>" }`
  - database query: `{ orderKey: "<sort-key>", id: "<uuid>" }`
  - search: `{ score: <num>, id: "<uuid>" }`
- Servers MUST validate the version `v`. New versions must remain readable for ≥ 60 days of overlap.

## Edge cases

- Empty result set: `{results: [], next_cursor: null, has_more: false}`.
- Last page exactly matches `page_size`: `has_more = false`, `next_cursor = null` only if no more rows exist. If unknown, return `has_more = true` and let the next call return empty (acceptable).
- Result mutated between pages: stable cursor still works because we order by `(position|created_time, id)` with a tie-breaker. Newly inserted items between cursors may appear later in pagination — documented and tested.

## Test obligations

- Contract tests in `tests/contract/pagination.test.ts` verify these properties against every paginated endpoint.
- Chaos tests verify malformed/expired cursors return 400, not 5xx.