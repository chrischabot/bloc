# Sorts

Passed as `sorts` (an array, evaluated in order) on `databases.query`, `data_sources.query`, and `search`.

## By property

```json
{ "property": "Due", "direction": "ascending" | "descending" }
```

## By timestamp

```json
{ "timestamp": "created_time" | "last_edited_time", "direction": "ascending" | "descending" }
```

## Notes

- Null values sort last by default. Pass `nulls: "first"` to flip.
- Multi-key sorts are evaluated left-to-right: the second key only matters for rows tied on the first.
- The default sort on `databases.query` is whatever the database schema declares; pass an empty `sorts: []` to opt into insertion order.
