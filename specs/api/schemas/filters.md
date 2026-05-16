# Filters

A filter object is passed to `POST /v1/databases/{id}/query` in the `filter` field.

## Top-level shape

A filter is **either** a single property filter **or** a compound filter.

### Single property filter

```jsonc
{
  "property": "Name" | "Status" | "<property name or id>",
  "<property_type>": {
    "<operator>": <operand>
  }
}
```

### Compound filter

```jsonc
{ "and": [ <filter>, <filter>, ... ] }
// or
{ "or":  [ <filter>, <filter>, ... ] }
```

Nesting depth ≤ 2 (an `and` inside an `or` inside an `and` would be depth 3 — reject).

## Operators per property type

### `title`, `rich_text`, `url`, `email`, `phone_number`

| Operator | Operand | Semantics |
|----------|---------|-----------|
| `equals` | string | exact match |
| `does_not_equal` | string | |
| `contains` | string | substring case-insensitive |
| `does_not_contain` | string | |
| `starts_with` | string | |
| `ends_with` | string | |
| `is_empty` | `true` | |
| `is_not_empty` | `true` | |

### `number`

| Operator | Operand |
|----------|---------|
| `equals` | number |
| `does_not_equal` | number |
| `greater_than` | number |
| `less_than` | number |
| `greater_than_or_equal_to` | number |
| `less_than_or_equal_to` | number |
| `is_empty` | `true` |
| `is_not_empty` | `true` |

### `checkbox`

| Operator | Operand |
|----------|---------|
| `equals` | bool |
| `does_not_equal` | bool |

### `select` / `status`

| Operator | Operand |
|----------|---------|
| `equals` | string (option name) |
| `does_not_equal` | string |
| `is_empty` | `true` |
| `is_not_empty` | `true` |

### `multi_select`

| Operator | Operand |
|----------|---------|
| `contains` | string (option name) |
| `does_not_contain` | string |
| `is_empty` | `true` |
| `is_not_empty` | `true` |

### `date`, `created_time`, `last_edited_time`

| Operator | Operand |
|----------|---------|
| `equals` | ISO date / datetime |
| `before` | ISO date / datetime |
| `after` | ISO date / datetime |
| `on_or_before` | ISO date / datetime |
| `on_or_after` | ISO date / datetime |
| `past_week` | `{}` |
| `past_month` | `{}` |
| `past_year` | `{}` |
| `next_week` | `{}` |
| `next_month` | `{}` |
| `next_year` | `{}` |
| `this_week` | `{}` |
| `is_empty` | `true` |
| `is_not_empty` | `true` |

### `people`, `created_by`, `last_edited_by`

| Operator | Operand |
|----------|---------|
| `contains` | uuid (user id) |
| `does_not_contain` | uuid |
| `is_empty` | `true` |
| `is_not_empty` | `true` |

### `files`

| Operator | Operand |
|----------|---------|
| `is_empty` | `true` |
| `is_not_empty` | `true` |

### `relation`

| Operator | Operand |
|----------|---------|
| `contains` | uuid (target page id) |
| `does_not_contain` | uuid |
| `is_empty` | `true` |
| `is_not_empty` | `true` |

### `formula`

The operator namespace depends on the formula's `type`:

```jsonc
{
  "property": "Total",
  "formula": {
    "string": { "contains": "..." },
    "number": { "greater_than": 10 },
    "checkbox": { "equals": true },
    "date": { "before": "2026-05-15" }
  }
}
```

Exactly one of `string`/`number`/`checkbox`/`date` is provided. Mismatch with the formula's compiled type → 400.

### `rollup`

```jsonc
{
  "property": "Total Hours",
  "rollup": {
    "number": { "greater_than": 40 },
    // or array/any/every/none variants
    "any":   { "rich_text": { "contains": "foo" } },
    "every": { "checkbox": { "equals": true } },
    "none":  { "select": { "equals": "Cancelled" } }
  }
}
```

## Compound filter rules

- `and` / `or` arrays must be non-empty.
- Max nesting depth: 2.
- Mixing operators at the same level is forbidden (`{and: [...], or: [...]}` → 400).

## Examples

### Filter open high-priority tasks edited this week

```json
{
  "and": [
    { "property": "Status", "status": { "does_not_equal": "Done" } },
    { "property": "Priority", "select": { "equals": "P0" } },
    { "property": "Last edited", "last_edited_time": { "this_week": {} } }
  ]
}
```

### Tasks assigned to me or due this week

```json
{
  "or": [
    { "property": "Assignee", "people": { "contains": "user-uuid" } },
    { "property": "Due", "date": { "this_week": {} } }
  ]
}
```

## Implementation notes (for the engine)

- Compile filter → SQL via `packages/db/src/query-engine.ts`.
- `select`/`multi_select`/`status` use jsonb `value->'select'->>'name'` etc.
- `date` operators use parameterised timestamps; relative ranges use server clock.
- `formula` filters require materialised eval per row when not SQL-compilable. Document the line.
- `rollup` filters similarly require post-fetch eval for non-trivial functions.

## Tests

- Per operator, per property type: at least one positive and one negative integration test.
- Chaos: unknown operator names, mismatched operand types, exceeding nesting depth all return 400.