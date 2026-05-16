# Pages Endpoints

## `POST /v1/pages`

Create a page.

**Body**:

```jsonc
{
  "parent": { "type": "database_id" | "page_id" | "workspace", ... },
  "properties": {
    "Name": { "title": [ /* RichText[] */ ] },
    "Status": { "status": { "name": "In progress" } }
  },
  "icon": { "type": "emoji", "emoji": "📝" } | null,
  "cover": { "type": "external", "external": { "url": "..." } } | null,
  "children": [ /* Block[] */ ]  // optional initial content
}
```

**Notes**:
- If parent is a database, the database's schema constrains `properties`. Required: `title`. Optional: all others; unsupplied defaults to null.
- If parent is a page, only the title property is meaningful (stored under the synthetic title id).
- `children` count ≤ 100; for more, append later.

**Response** (200): the `Page` object.

## `GET /v1/pages/{page_id}`

Retrieve a page.

**Query**:
- `filter_properties` (optional, repeatable): `?filter_properties=prop-id&filter_properties=prop-id` — return only those properties (others omitted).

**Response** (200): `Page`.

## `PATCH /v1/pages/{page_id}`

Update properties and/or archived state and/or icon/cover.

**Body**:

```jsonc
{
  "properties": { "Status": { "status": { "name": "Done" } } },
  "icon": null,                 // null clears
  "cover": null,
  "archived": true
}
```

**Response** (200): updated `Page`.

## `GET /v1/pages/{page_id}/properties/{property_id}`

Retrieve a single property in full (for properties that may be truncated on the page object: `relation`, `people`, `rich_text` ≥ 25 items, `title` ≥ 25, `rollup` arrays).

**Query**:
- `start_cursor`, `page_size`

**Response** (200):

For scalar properties (number, select, status, checkbox, …):

```jsonc
{
  "object": "property_item",
  "id": "<property_id>",
  "type": "<type>",
  "<type>": <value>
}
```

For paginated array properties (title, rich_text, relation, people, rollup-array):

```jsonc
{
  "object": "list",
  "type": "property_item",
  "results": [ /* property_item objects, one per element */ ],
  "next_cursor": "...|null",
  "has_more": true|false,
  "property_item": { "id": "<property_id>", "type": "<type>", "next_url": "..." }
}
```

## `Page` object

```jsonc
{
  "object": "page",
  "id": "uuid",
  "created_time": "...",
  "created_by": { "object":"user", "id":"..." },
  "last_edited_time": "...",
  "last_edited_by": { "object":"user", "id":"..." },
  "archived": false,
  "in_trash": false,
  "icon": null | { "type":"emoji","emoji":"..."} | external | file,
  "cover": null | external | file,
  "properties": { "Name": <property_value>, ... },
  "parent": { ... },
  "url": "https://our-domain/<workspace>/<id>",
  "public_url": null | "https://our-domain/p/<id>"
}
```

## Test obligations

- Contract tests cover create/retrieve/update/archive lifecycle.
- SDK-progressive: `client.pages.create`, `.retrieve`, `.update`, `.properties.retrieve`.
- Chaos: missing required title, invalid select option, oversized properties, cycle parent, restricted parent — all 4xx.
- Benchmark: create p99 < 200ms; retrieve p99 < 150ms.