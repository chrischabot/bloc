# Property Types

A property has two faces:

1. **Schema config** — defined on the parent database; describes the type and any per-type options. Lives in `database_properties.config`.
2. **Value** — stored on each page that belongs to the database; the page's value of that property. Lives in `page_properties.value`.

Both share the discriminator `type`.

## Catalogue

| `type` | Notes |
|--------|-------|
| `title` | Exactly one per database; required |
| `rich_text` | Multi-line formatted text |
| `number` | Numeric with format (number, dollar, euro, pound, yen, rupee, won, real, lira, ruble, rupiah, franc, hong_kong_dollar, new_zealand_dollar, krona, norwegian_krone, mexican_peso, rand, new_taiwan_dollar, danish_krone, zloty, baht, forint, koruna, shekel, chilean_peso, philippine_peso, dirham, riyal, ringgit, leu, argentine_peso, uruguayan_peso, percent, number_with_commas) |
| `select` | Single option from a fixed list |
| `multi_select` | Multiple options |
| `status` | Single option from groups (To-do, In progress, Done) |
| `date` | Single date or date range, optional time + zone |
| `people` | Array of user references |
| `files` | Array of file references |
| `checkbox` | Boolean |
| `url` | URL string |
| `email` | Email string |
| `phone_number` | Phone string |
| `formula` | Computed from formula expression |
| `relation` | Array of references to pages in a target database |
| `rollup` | Computed by aggregating values across a relation |
| `created_time` | Read-only |
| `created_by` | Read-only |
| `last_edited_time` | Read-only |
| `last_edited_by` | Read-only |
| `unique_id` | Auto-incrementing identifier with optional prefix (e.g. `TASK-128`); immutable per row |
| `verification` | Wiki verification chip; value envelope `{ state, verified_by, verified_at, expires_at }` |
| `button` | A property-level action button on each row; runs the configured automation steps (see `docs/frontend/20-buttons-automations.md`) |
| `place` | Geographic location with coordinates + display name (geocoded via the configured provider) |

That is 24 property types — Notion's full set including the wiki-verification, unique-id, row-button, and place extensions. The user-request target said "~15"; the complete set is implemented.

## Common config wrapper

```jsonc
{
  "id": "uuid",
  "name": "Display name",
  "type": "<one of above>",
  "<type>": { /* type-specific config */ }
}
```

## Per-type config schemas

### `title`

```jsonc
{ "type": "title", "title": {} }
```

No config; always present in every database; exactly one allowed.

### `rich_text`

```jsonc
{ "type": "rich_text", "rich_text": {} }
```

### `number`

```jsonc
{ "type": "number", "number": { "format": "dollar" } }
```

### `select`

```jsonc
{
  "type": "select",
  "select": {
    "options": [
      { "id": "uuid", "name": "Low", "color": "gray", "description": null }
    ]
  }
}
```

- `color` from the 10 fg colors.
- `name` unique per property.

### `multi_select`

```jsonc
{ "type": "multi_select", "multi_select": { "options": [ ... ] } }
```

### `status`

```jsonc
{
  "type": "status",
  "status": {
    "options": [
      { "id": "...", "name": "Not started", "color": "default", "description": null }
    ],
    "groups": [
      { "id": "...", "name": "To-do", "color": "gray", "option_ids": [ "..." ] },
      { "id": "...", "name": "In progress", "color": "blue", "option_ids": [ "..." ] },
      { "id": "...", "name": "Done", "color": "green", "option_ids": [ "..." ] }
    ]
  }
}
```

### `date`

```jsonc
{ "type": "date", "date": {} }
```

### `people`

```jsonc
{ "type": "people", "people": {} }
```

### `files`

```jsonc
{ "type": "files", "files": {} }
```

### `checkbox`

```jsonc
{ "type": "checkbox", "checkbox": {} }
```

### `url` / `email` / `phone_number`

```jsonc
{ "type": "url", "url": {} }
```

### `formula`

```jsonc
{ "type": "formula", "formula": { "expression": "prop(\"Price\") * 1.2" } }
```

Formula grammar — see `docs/api/schemas/formulas.md`.

### `relation`

```jsonc
{
  "type": "relation",
  "relation": {
    "database_id": "uuid",
    "type": "single_property" | "dual_property",
    "single_property": {},
    "dual_property": { "synced_property_id": "uuid", "synced_property_name": "Tasks" }
  }
}
```

- `single_property`: one-way relation.
- `dual_property`: bidirectional; an inverse property is auto-created in the target database.

### `rollup`

```jsonc
{
  "type": "rollup",
  "rollup": {
    "relation_property_id": "uuid",
    "relation_property_name": "Tasks",
    "rollup_property_id": "uuid",
    "rollup_property_name": "Status",
    "function": "show_original" | "show_unique" | "count" | "count_values" | "empty" | "not_empty" | "unique" | "percent_empty" | "percent_not_empty" | "sum" | "average" | "median" | "min" | "max" | "range" | "earliest_date" | "latest_date" | "date_range" | "checked" | "unchecked" | "percent_checked" | "percent_unchecked"
  }
}
```

### `created_time` / `created_by` / `last_edited_time` / `last_edited_by`

No config:

```jsonc
{ "type": "created_time", "created_time": {} }
```

### `unique_id`

```jsonc
{ "type": "unique_id", "unique_id": { "prefix": "TASK" } }
```

### `verification`

```jsonc
{ "type": "verification", "verification": {} }
```

### `button`

```jsonc
{
  "type": "button",
  "button": {
    "steps": [ /* AutomationStep[] from docs/api/schemas/automation-actions.md */ ]
  }
}
```

### `place`

```jsonc
{ "type": "place", "place": { "geocoder": "mapbox" | "google" | "none" } }
```

## Per-type value envelopes (`page_properties.value`)

Each value is `{ id, type, <type>: <value> }`. The page-properties API returns `{ id, type, <type>: <value> }`.

### `title`

```jsonc
{ "id": "...", "type": "title", "title": [ /* RichText[] */ ] }
```

### `rich_text`

```jsonc
{ "id": "...", "type": "rich_text", "rich_text": [ /* RichText[] */ ] }
```

### `number`

```jsonc
{ "id": "...", "type": "number", "number": 1234.5 }
```

### `select`

```jsonc
{ "id": "...", "type": "select", "select": { "id": "...", "name": "Low", "color": "gray" } | null }
```

### `multi_select`

```jsonc
{ "id": "...", "type": "multi_select", "multi_select": [ { "id":"...","name":"P0","color":"red" } ] }
```

### `status`

```jsonc
{ "id": "...", "type": "status", "status": { "id":"...", "name":"In progress", "color":"blue" } | null }
```

### `date`

```jsonc
{ "id": "...", "type": "date", "date": { "start": "2026-05-15", "end": null, "time_zone": null } | null }
```

- `start` is ISO 8601 date or datetime.
- If `end` is provided, must be ≥ `start`.
- `time_zone` is an IANA name; when present, `start`/`end` are interpreted in that zone.

### `people`

```jsonc
{ "id":"...", "type":"people", "people": [ { "object":"user", "id":"uuid" } ] }
```

### `files`

```jsonc
{
  "id":"...","type":"files",
  "files": [
    { "name": "spec.pdf", "type": "file", "file": { "url":"...", "expiry_time":"..." } },
    { "name": "logo",     "type": "external", "external": { "url":"https://..." } }
  ]
}
```

### `checkbox`

```jsonc
{ "id":"...","type":"checkbox","checkbox": true }
```

### `url` / `email` / `phone_number`

```jsonc
{ "id":"...","type":"url","url":"https://..." | null }
```

### `formula`

```jsonc
{
  "id":"...","type":"formula",
  "formula": {
    "type": "string" | "number" | "boolean" | "date",
    "string": "...",
    "number": 1.5,
    "boolean": true,
    "date": { "start":"...", "end": null, "time_zone": null }
  }
}
```

Exactly one of `string`/`number`/`boolean`/`date` is populated per the `formula.type`.

### `relation`

```jsonc
{ "id":"...","type":"relation","relation": [ { "id":"uuid" } ], "has_more": false }
```

- `has_more` indicates the array was truncated to 25; full list via `GET /pages/{id}/properties/{property_id}`.

### `rollup`

```jsonc
{
  "id":"...","type":"rollup",
  "rollup": {
    "function": "sum",
    "type": "number" | "array" | "date" | "incomplete" | "unsupported",
    "number": 42,
    "array": [ /* property_item[] */ ],
    "date": { ... },
    "incomplete": {}
  }
}
```

### `created_time` / `last_edited_time`

```jsonc
{ "id":"...","type":"created_time","created_time":"iso8601" }
```

### `created_by` / `last_edited_by`

```jsonc
{ "id":"...","type":"created_by","created_by": { "object":"user", "id":"uuid" } }
```

### `unique_id`

```jsonc
{ "id":"...","type":"unique_id","unique_id":{ "prefix":"TASK", "number": 128 } }
```

Read-only; assigned server-side on row create.

### `verification`

```jsonc
{
  "id":"...","type":"verification",
  "verification": {
    "state": "verified" | "unverified",
    "verified_by": { "object":"user","id":"uuid" } | null,
    "verified_at": "iso8601" | null,
    "expires_at": "iso8601" | null
  }
}
```

### `button`

Value: rendered as a clickable cell; invocation goes through `POST /v1/pages/{id}/properties/{property_id}/invoke` and returns an `automation_run` object.

### `place`

```jsonc
{
  "id":"...","type":"place",
  "place": {
    "name": "Notion HQ",
    "address": "...",
    "lat": 37.78,
    "lng": -122.40
  } | null
}
```

## Validation rules

- Property values are validated against the **current** database schema; a value with a stale select option id is rejected with 400.
- Creating a select/multi_select/status value with a `name` that does not match an existing option creates that option automatically (Notion behaviour) when `name` only is provided. Providing an explicit `id` requires the id to exist.
- Relation values reject IDs not in the target database; soft-archived target pages are allowed but flagged as such on retrieve.

## Tests

- Per-type unit tests for config and value round-trips.
- Contract tests: create database with property → create page → retrieve → compare.
- Filter operator tests live under `docs/api/schemas/filters.md`.
- Chaos: invalid select id, mismatched relation database, malformed date, oversized rich_text — all 400.