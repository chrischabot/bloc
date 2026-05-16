# Databases Endpoints

## `POST /v1/databases`

Create a database.

**Body**:

```jsonc
{
  "parent": { "type": "page_id", "page_id": "uuid" },
  "title": [ /* RichText[] */ ],
  "description": [ /* RichText[] */ ],
  "icon": null | { ... },
  "cover": null | { ... },
  "is_inline": false,
  "properties": {
    "Name":     { "type":"title", "title": {} },
    "Status":   { "type":"status","status": { ... } },
    "Priority": { "type":"select","select":{"options":[...]}}
  }
}
```

**Constraints**: exactly one `title` property.

**Response** (200): `Database`.

## `GET /v1/databases/{database_id}`

Retrieve database schema.

**Response** (200): `Database`.

## `PATCH /v1/databases/{database_id}`

Update database schema, title, description, icon, cover, archived.

**Body**:

```jsonc
{
  "title": [...],
  "description": [...],
  "icon": null | {...},
  "cover": null | {...},
  "properties": {
    "Status": { "name": "State", "status": { ... } },     // rename + reconfigure
    "Old Field": null                                     // remove
  },
  "archived": false
}
```

Renaming a property uses the property's current name as the key with a new `name` value. Adding a new property uses a new key. Removing uses `null` value.

**Response** (200): updated `Database`.

## `POST /v1/databases/{database_id}/query`

Query database rows.

**Body**:

```jsonc
{
  "filter": <filter object | undefined>,
  "sorts": [ <sort object>, ... ],
  "start_cursor": "...|undefined",
  "page_size": 100,
  "filter_properties": ["prop-id", ...]
}
```

**Response** (200):

```jsonc
{
  "object": "list",
  "type": "page_or_database",
  "results": [ /* Page[] (rows of the database) */ ],
  "next_cursor": "...|null",
  "has_more": true|false,
  "page_or_database": {}
}
```

**Notes**:
- Query runs against pages whose `parent.database_id == database_id`.
- Filter+sort compiled to SQL where possible; formula/rollup conditions evaluated in Node when not SQL-compilable.
- `filter_properties` trims returned properties to those listed — useful for narrow column subsets.

## `Database` object

```jsonc
{
  "object": "database",
  "id": "uuid",
  "created_time": "...",
  "last_edited_time": "...",
  "title": [...],
  "description": [...],
  "icon": null | ...,
  "cover": null | ...,
  "properties": {
    "Name": { "id":"...","name":"Name","type":"title","title":{} },
    ...
  },
  "parent": { ... },
  "url": "...",
  "archived": false,
  "in_trash": false,
  "is_inline": false,
  "public_url": null
}
```

## Test obligations

- Contract: create database with every property type, query with every filter operator, sort by every property type.
- SDK-progressive: `client.databases.create`, `.retrieve`, `.update`, `.query`.
- Chaos: filter nesting > 2, unknown operators, filter type mismatch, oversized result, malformed cursor — all 4xx.
- Benchmark: query (10k rows, 3-clause AND filter) p99 < 250ms.