# Versions

Per-page version history.

## List versions

`GET /v1/pages/{page_id}/versions?page_size=50&start_cursor=…`

```json
{
  "object": "list",
  "type": "page_version",
  "results": [
    {
      "object": "page_version",
      "page_id": "uuid",
      "clock": 142,
      "created_at": "...",
      "update_bytes": 312
    }
  ],
  "next_cursor": null,
  "has_more": false
}
```

`clock` is the realtime op-log clock. Higher = more recent.

## Retrieve a version snapshot

`GET /v1/pages/{page_id}/versions/{clock}`

```json
{
  "object": "page_version_snapshot",
  "page_id": "uuid",
  "clock": 142,
  "created_at": "...",
  "update_bytes": 312,
  "updates_through_clock": 142,
  "recordMap": { ... },
  "notes": [ "Created by alice@", "Restored from clock 119" ]
}
```

The `recordMap` is the same shape as `/api/v3/loadPageChunk` — you can render it through `<NotionRenderer/>` to show a point-in-time view.

## Restore a version

There's no dedicated restore endpoint. To restore: render the version, then write blocks back via `PATCH /v1/blocks/{block_id}` / `PATCH /v1/blocks/{block_id}/children`. The version history retains the restore as a new clock entry.

## Retention

By default versions are retained for 30 days; configurable per workspace plan in the admin settings. Older entries roll up into a single coalesced snapshot.
