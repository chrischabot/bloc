# Pages

Endpoints under `/v1/pages`.

## Create a page

`POST /v1/pages`

```json
{
  "parent": { "page_id": "uuid" } | { "database_id": "uuid" } | { "workspace": true },
  "properties": { "title": { "title": [{ "text": { "content": "Hello" } }] } },
  "icon":  { "type": "emoji", "emoji": "📄" } | null,
  "cover": { "type": "external", "external": { "url": "..." } } | null,
  "children": [ /* Block[] */ ]
}
```

`parent` is required. One of `page_id`, `database_id`, `workspace: true`.

Response: a `PageObject`.

## Retrieve a page

`GET /v1/pages/{page_id}`

Optional query: `filter_properties=<id>,<id>,…` to restrict the `properties` payload to a subset (useful for performance on wide databases).

## Update a page

`PATCH /v1/pages/{page_id}`

```json
{
  "properties": { "Status": { "status": { "name": "Done" } } },
  "icon":      { ... } | null,
  "cover":     { ... } | null,
  "archived":  false,
  "in_trash":  false
}
```

## Archive / delete

`DELETE /v1/pages/{page_id}`

Soft-archive by default. Pass `?permanent=true` to permanently remove an *already archived* page; permanent deletion of a non-archived page is refused with `409 conflict_error`.

## Retrieve a page property

`GET /v1/pages/{page_id}/properties/{property_id}`

Returns a `PropertyItem`. For paginated property types (`relation`, `people`, `rich_text` >25 entries), this returns a list with `next_cursor` / `has_more`. Use `page_size` and `start_cursor`.

## Versions

See [Versions](./versions.md) — `/v1/pages/{page_id}/versions` and `/v1/pages/{page_id}/versions/{clock}`.

## Permissions

See [Permissions](./permissions.md) — `/v1/pages/{page_id}/permissions[/me]`.

## Backlinks

`GET /v1/pages/{page_id}/backlinks` — list pages that mention this one. Standard pagination.

## Exports

`POST /v1/pages/{page_id}/exports`

```json
{ "format": "html" | "markdown" | "pdf", "include_subpages": true | false }
```

Returns:

```json
{
  "object": "export",
  "id": "uuid",
  "status": "queued" | "running" | "completed" | "failed",
  "format": "html",
  "url": "https://.../signed?…"  // null until status == 'completed'
}
```

Poll `GET /v1/exports/{id}` until `status == 'completed'`, then download the signed URL.

## Wikis & verification

If the page is a wiki entry: `POST /v1/pages/{page_id}/verify` toggles the verified state; `DELETE /v1/pages/{page_id}/verify` clears it. See [end-user wikis](../../apps/wikis.md).
