# Data sources

A data source is the unit a database view queries. Every database starts with one **owned** data source; you can add more, and link to data sources owned by other databases.

## Create a data source

`POST /v1/databases/{database_id}/data_sources`

```json
{
  "name": "Engineering rows",
  "type": "owned" | "linked",
  "source_data_source_id": "uuid"   // required if type == 'linked'
}
```

## List data sources of a database

`GET /v1/databases/{database_id}/data_sources`

## Retrieve a data source

`GET /v1/data_sources/{data_source_id}`

## Update a data source

`PATCH /v1/data_sources/{data_source_id}`

```json
{ "name": "...", "archived": false }
```

## Delete a data source

`DELETE /v1/data_sources/{data_source_id}`

Owned data sources can be deleted only if no view depends on them. Linked data sources can always be deleted; the source database is unaffected.

## Query a data source

`POST /v1/data_sources/{data_source_id}/query`

```json
{ "filter": { ... }, "sorts": [ ... ], "start_cursor": "...", "page_size": 50 }
```

Same shape as `databases.query`. Returns a list of `page_or_data_source`.
