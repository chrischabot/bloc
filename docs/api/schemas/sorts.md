# Sorts

A sort array is passed to `POST /v1/databases/{id}/query` in the `sorts` field.

## Shape

```jsonc
[
  { "property": "Priority", "direction": "ascending" | "descending" },
  { "timestamp": "created_time" | "last_edited_time", "direction": "ascending" | "descending" }
]
```

- Up to 8 sort entries.
- Each entry has exactly one of `property` or `timestamp`, plus `direction`.
- Multiple entries: rows are ordered lexicographically.

## Per-property sort semantics

- `title`, `rich_text`, `url`, `email`, `phone_number`: locale-aware case-insensitive string compare; nulls last for ascending, first for descending (configurable: default last for asc).
- `number`: numeric; null last.
- `select`/`status`: by option's `position` in the schema (Notion behaviour), not by name.
- `multi_select`: by the first option's position; ties broken by entire array's joined names.
- `date`, `created_time`, `last_edited_time`: chronological; null last.
- `checkbox`: true > false in descending.
- `people`: by first user's name.
- `files`: by file count then first file name.
- `relation`: by first relation target's title.
- `formula`: by computed value, type-appropriate sort.
- `rollup`: same as formula.

## Stability

When two rows compare equal, the tie-breaker is `(created_time asc, id asc)`. This is documented because pagination cursors depend on stable ordering.

## Errors

- Unknown property → 400 `invalid_request`.
- Unknown direction → 400.
- > 8 entries → 400.
- Mixing `property` and `timestamp` in one entry → 400.