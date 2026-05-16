# Calendar Endpoints

See `docs/frontend/31-calendar-app.md`.

## Events

### `GET /v1/calendar/events`

Query: `from=<iso>`, `to=<iso>`, `sources=<comma-separated source ids>`, `expand=attendees`.

**Response**:
```jsonc
{
  "object":"list","type":"calendar_event",
  "results":[
    {
      "object":"calendar_event",
      "id":"uuid",
      "source": { "id":"uuid","provider":"google","color":"#2383e2" },
      "title":"Standup",
      "start":"2026-05-15T14:00:00Z",
      "end":"2026-05-15T14:30:00Z",
      "all_day": false,
      "attendees":[ { "email":"...","status":"accepted" } ],
      "location":"Zoom",
      "notes_url":"https://...",            // if the event has Notion meeting notes
      "external_url":"https://calendar.google.com/...",
      "page_id":"uuid|null"                 // if backed by a Notion DB row
    }
  ],
  "next_cursor": null, "has_more": false
}
```

### `POST /v1/calendar/events`

Body: `{ "source_id":"...","title":"","start":"...","end":"...","attendees":[...],"location":"","notes":true }`.

If `notes:true`, server creates a Notion Meeting Notes page (see `docs/frontend/18-ai.md#ai-meeting-notes`) and links it.

### `PATCH /v1/calendar/events/{id}`

Partial update. Server routes the patch to the underlying source provider.

### `DELETE /v1/calendar/events/{id}`

## Sources

### `GET /v1/calendar/sources`

### `POST /v1/calendar/sources`

Body: `{ "provider":"google", "oauth_state":"..." }` to initiate, then `code` to complete. For `notion_database` sources: `{ "provider":"notion_database", "database_id":"...", "date_property_id":"...", "end_property_id":null, "color":"..." }`.

### `DELETE /v1/calendar/sources/{id}`

### `PATCH /v1/calendar/sources/{id}`

Adjust color, enabled, default for new events.

## Find a time

### `POST /v1/calendar/find_time`

Body:
```jsonc
{
  "attendees":[ "<user_id|email>", ... ],
  "duration_minutes": 30,
  "range":{ "from":"...","to":"..." },
  "working_hours": { "start":"09:00","end":"18:00","days":["mon","tue","wed","thu","fri"] }
}
```

**Response**:
```jsonc
{ "suggestions":[ { "start":"...","end":"...","attendees_busy":[] }, ... ] }
```

## Tests

- Integration: create a Notion-DB-source event, assert row created; create a Google event (with stub provider), assert provider invoked.
- Chaos: malformed RRULE, oversized attendees list, expired OAuth → 401 with refresh hint.
- Observability: `calendar.event.<verb>` span with provider; `find_time.duration_ms` histogram.