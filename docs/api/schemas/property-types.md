# Property types

Database properties have a **schema shape** (defined on the database) and a **value shape** (set on each row / page). Both are documented per type here.

## Title

```json
// Schema
{ "title": {} }
// Value
{ "title": [ /* RichText[] */ ] }
```

Exactly one title property per database, named `title` by convention but renameable.

## Rich text

```json
// Schema
{ "rich_text": {} }
// Value
{ "rich_text": [ /* RichText[] */ ] }
```

## Number

```json
// Schema
{ "number": { "format": "number" | "number_with_commas" | "percent" | "dollar" | ... } }
// Value
{ "number": 42 | null }
```

## Select

```json
// Schema
{ "select": { "options": [ { "id": "...", "name": "Done", "color": "green" } ] } }
// Value
{ "select": { "id": "...", "name": "Done", "color": "green" } | null }
```

## Multi-select

```json
// Schema (same as select)
// Value
{ "multi_select": [ { "id": "...", "name": "Bug", "color": "red" } ] }
```

## Status

```json
// Schema
{
  "status": {
    "options": [
      { "id": "...", "name": "To do",       "color": "default", "group": "..." }
    ],
    "groups":  [ { "id": "...", "name": "To do", "color": "default", "option_ids": [ ... ] } ]
  }
}
// Value
{ "status": { "id": "...", "name": "Doing", "color": "yellow" } | null }
```

## Date

```json
// Schema
{ "date": {} }
// Value
{
  "date": {
    "start":      "2025-05-16",
    "end":        "2025-05-20" | null,
    "time_zone":  "Europe/Amsterdam" | null
  } | null
}
```

Dates may be all-day (`"2025-05-16"`) or with time (`"2025-05-16T14:00:00.000Z"`).

## People

```json
// Schema
{ "people": {} }
// Value
{ "people": [ { "object": "user", "id": "...", "name": "...", "avatar_url": "..." } ] }
```

## Files

```json
// Schema
{ "files": {} }
// Value
{
  "files": [
    { "name": "report.pdf", "type": "file",     "file":     { "url": "...", "expiry_time": "..." } },
    { "name": "logo.png",   "type": "external", "external": { "url": "..." } }
  ]
}
```

Uploading a file: use the upload-token flow at `POST /v1/files/upload-token`, PUT the bytes to the returned signed URL, then patch the property with `type: "file"` and the upload id.

## Checkbox

```json
{ "checkbox": {} }
{ "checkbox": false }
```

## URL / email / phone

```json
{ "url": {} }                  // schema
{ "url": "https://..." | null }
{ "email": {} }
{ "email": "..." | null }
{ "phone_number": {} }
{ "phone_number": "..." | null }
```

## Formula

```json
// Schema
{ "formula": { "expression": "prop(\"Score\") * 2" } }
// Value (one of)
{ "formula": { "type": "string",  "string": "..." } }
{ "formula": { "type": "number",  "number": 42 } }
{ "formula": { "type": "boolean", "boolean": true } }
{ "formula": { "type": "date",    "date": { "start": "..." } } }
```

Formula expressions follow Notion's syntax: `prop("X")`, arithmetic, `if`, `concat`, `dateBetween`, etc. See [Formulas](./formulas.md).

## Relation

```json
// Schema
{
  "relation": {
    "database_id": "uuid",
    "type": "single_property" | "dual_property",
    "single_property": {},
    "dual_property": { "synced_property_name": "...", "synced_property_id": "..." }
  }
}
// Value
{ "relation": [ { "id": "uuid" } ] }
```

## Rollup

```json
// Schema
{
  "rollup": {
    "relation_property_name": "Tasks",
    "relation_property_id":   "...",
    "rollup_property_name":   "Status",
    "rollup_property_id":     "...",
    "function": "count" | "sum" | "average" | "median" | "min" | "max" | "earliest_date" | "latest_date" | "show_original" | ...
  }
}
// Value (depends on function)
{ "rollup": { "type": "number", "function": "sum", "number": 12 } }
{ "rollup": { "type": "date",   "function": "earliest_date", "date": { ... } } }
{ "rollup": { "type": "array",  "function": "show_original", "array": [ ... ] } }
```

## Created/last-edited time/by

System-managed. Schema is just `{ created_time: {} }`, value is the ISO string or user object. You can't write to these.

## Unique id

```json
// Schema
{ "unique_id": { "prefix": "BUG" } }
// Value
{ "unique_id": { "prefix": "BUG", "number": 142 } }   // BUG-142
```

Numbers auto-increment per database. Cannot be modified after creation.

## Verification

```json
// Schema
{ "verification": {} }
// Value
{ "verification": { "state": "verified" | "expired" | "none", "verified_by": { "id": "..." } | null, "date": { "start": "..." } | null } }
```

Settable only via the wiki-verification endpoints.

## Button

```json
// Schema
{ "button": { "automation_id": "uuid" } }
// Value
{ "button": {} }
```

The value is always `{}` — clicking invokes the automation; the property itself has no data.
