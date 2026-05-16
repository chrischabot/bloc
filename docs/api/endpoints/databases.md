# Databases

Endpoints under `/v1/databases`.

## Create a database

`POST /v1/databases`

```json
{
  "parent": { "page_id": "uuid" } | { "workspace": true },
  "title": [ /* RichText[] */ ],
  "description": [ /* RichText[] */ ],
  "icon":  { ... } | null,
  "cover": { ... } | null,
  "is_inline": false,
  "properties": {
    "Name":   { "title": {} },
    "Status": { "status": { "options": [ /* { name, color, ... } */ ] } },
    "Due":    { "date": {} },
    "Owner":  { "people": {} }
  }
}
```

`properties` is the database schema — each entry is a property type plus its configuration. See [Property types](../schemas/property-types.md).

## Retrieve a database

`GET /v1/databases/{database_id}`

## Update a database

`PATCH /v1/databases/{database_id}`

Update title, description, icon, cover, archived, or `properties` (add / rename / remove columns). To rename a property:

```json
{ "properties": { "Status": { "name": "Stage" } } }
```

To remove a property:

```json
{ "properties": { "Status": null } }
```

## Query a database

`POST /v1/databases/{database_id}/query`

```json
{
  "filter":  { /* see Filters */ },
  "sorts":   [ /* see Sorts */ ],
  "start_cursor": "...",
  "page_size": 50
}
```

Returns a list of pages (database rows). See [Filters](../schemas/filters.md) and [Sorts](../schemas/sorts.md) for the operator catalogue.

## Data sources

A database can have multiple data sources. The default is an "owned" data source matching the database itself. Linked data sources point at another database's owned data source.

`POST /v1/databases/{database_id}/data_sources` — create.
`GET  /v1/databases/{database_id}/data_sources` — list.

Then operate at the data-source endpoints in [Data sources](./data-sources.md).

## Automations

`GET  /v1/databases/{database_id}/automations` — list automations.
`POST /v1/databases/{database_id}/automations` — create.

See [Automations](./automations.md).

## Exports

`POST /v1/databases/{database_id}/exports` — `format: "csv" | "json" | "markdown"`. Same shape as page exports.
