# Filters

Passed in the body of `databases.query` and `data_sources.query` (and used internally by views and charts).

## Compound

```json
{ "and": [ filter, filter, ... ] }
{ "or":  [ filter, filter, ... ] }
```

Can nest one level deep (an `and` of `or`s is fine; two levels of `and` is not).

## Per-property leaf

```json
{
  "property": "Status",
  "<type>": { "<operator>": <value> }
}
```

Operators by property type:

### Title, rich_text, url, email, phone_number

| Operator | Value |
|---|---|
| `equals`, `does_not_equal` | string |
| `contains`, `does_not_contain` | string |
| `starts_with`, `ends_with` | string |
| `is_empty`, `is_not_empty` | `true` |

### Number

| Operator | Value |
|---|---|
| `equals`, `does_not_equal` | number |
| `greater_than`, `less_than`, `greater_than_or_equal_to`, `less_than_or_equal_to` | number |
| `is_empty`, `is_not_empty` | `true` |

### Checkbox

| Operator | Value |
|---|---|
| `equals`, `does_not_equal` | boolean |

### Select, status

| Operator | Value |
|---|---|
| `equals`, `does_not_equal` | option name |
| `is_empty`, `is_not_empty` | `true` |

### Multi-select

| Operator | Value |
|---|---|
| `contains`, `does_not_contain` | option name |
| `is_empty`, `is_not_empty` | `true` |

### Date, created_time, last_edited_time

| Operator | Value |
|---|---|
| `equals`, `before`, `after`, `on_or_before`, `on_or_after` | ISO date |
| `is_empty`, `is_not_empty` | `true` |
| `past_week`, `past_month`, `past_year`, `next_week`, `next_month`, `next_year`, `this_week` | `{}` |

### People, created_by, last_edited_by

| Operator | Value |
|---|---|
| `contains`, `does_not_contain` | user id |
| `is_empty`, `is_not_empty` | `true` |

### Files

| Operator | Value |
|---|---|
| `is_empty`, `is_not_empty` | `true` |

### Relation

| Operator | Value |
|---|---|
| `contains`, `does_not_contain` | page id |
| `is_empty`, `is_not_empty` | `true` |

### Formula

The leaf carries an inner filter shape matching the formula's result type:

```json
{ "property": "Score", "formula": { "number":  { "greater_than": 10 } } }
{ "property": "Done?", "formula": { "checkbox": { "equals": true } } }
{ "property": "Name",  "formula": { "string":  { "contains": "foo" } } }
{ "property": "Due",   "formula": { "date":    { "before": "..." } } }
```

### Rollup

Like formula — match by inner type, or use `any` / `every` / `none` over the rolled-up array:

```json
{ "property": "Sub-statuses", "rollup": { "any":  { "status": { "equals": "Done" } } } }
{ "property": "Sub-statuses", "rollup": { "every":{ "status": { "equals": "Done" } } } }
{ "property": "Sub-statuses", "rollup": { "none": { "status": { "equals": "Blocked" } } } }
```

## Timestamp (without naming a property)

```json
{ "timestamp": "created_time" | "last_edited_time", "<timestamp>": { "after": "..." } }
```

## Examples

All open bugs assigned to me, due this week, ordered by severity:

```json
{
  "filter": {
    "and": [
      { "property": "Status", "status": { "equals": "Open" } },
      { "property": "Assignee", "people": { "contains": "<my-user-id>" } },
      { "property": "Due", "date": { "this_week": {} } }
    ]
  },
  "sorts": [ { "property": "Severity", "direction": "ascending" } ]
}
```
