# Data Sources Endpoints

See `docs/architecture/10-data-sources.md` for product / data-model background.

These endpoints are available from `Notion-Version: 2025-09-03` onward. Older versions continue to use the database-keyed routes which now resolve to the database's **default** data source.

## `POST /v1/databases/{database_id}/data_sources`

Create a new data source under a database.

**Body**:
```jsonc
{
  "name": "Archived tasks",
  "type": "owned" | "linked",
  "source_data_source_id": "uuid"   // required when type=linked
}
```

**Response** (200): `DataSource`.

## `GET /v1/databases/{database_id}/data_sources`

List the database's data sources.

## `GET /v1/data_sources/{id}`

Retrieve a data source (schema + meta).

**Response** (200):
```jsonc
{
  "object": "data_source",
  "id": "uuid",
  "database_id": "uuid",
  "name": "...",
  "type": "owned" | "linked",
  "linked_from": null | { "database_id":"...","data_source_id":"..." },
  "properties": { /* per-property config, same shape as the legacy database.properties */ },
  "created_time": "...",
  "last_edited_time": "...",
  "archived": false
}
```

## `PATCH /v1/data_sources/{id}`

Rename, archive, or modify schema (only for `type=owned`).

## `DELETE /v1/data_sources/{id}`

Archive.

## `POST /v1/data_sources/{id}/query`

Query rows. Body identical to the legacy `POST /v1/databases/{id}/query` (filter / sorts / pagination / filter_properties).

**Response** (200):
```jsonc
{
  "object": "list",
  "type": "page_or_data_source",
  "results": [ /* Page[] */ ],
  "next_cursor": null,
  "has_more": false,
  "data_source": { ... }
}
```

## Dual routing

For `Notion-Version: 2025-09-03+`:

- `POST /v1/pages` accepts `parent.data_source_id` (preferred) or `parent.database_id` (resolves to default source).
- Response objects include both `parent.database_id` and `parent.data_source_id` for forward compatibility.

For older versions, only `database_id` is accepted on input and only `database_id` is present on responses.

## Errors

| HTTP | Code |
|------|------|
| 400 | `invalid_request` |
| 404 | `object_not_found` |
| 409 | `conflict_error` (creating a linked source against a target that is itself linked — cycle) |
| 422 | `unprocessable_entity` (schema change on a linked source) |
| 422 | `linked_source_read_only` (schema-mutation PATCH against a view backed by a linked source) |

## Tests

- Contract per endpoint; cross-version migration test.
- SDK-progressive: `client.dataSources.create/retrieve/update/query/delete` byte-match the official client.
- Chaos: linked-source cycle attempts, cross-workspace linkage without permission, mixed-parameter requests (both `database_id` and `data_source_id`) → 400.
- Observability: every endpoint emits a span with `database.id` AND `data_source.id`.