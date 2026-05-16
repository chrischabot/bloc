# Notion Calendar

A unified calendar that aggregates external calendar events (Google, iCloud, Microsoft) **and** date-bearing rows from connected Notion databases.

Reached from sidebar quick-actions → **Calendar**, or the dedicated route `/<workspaceSlug>/calendar`. The desktop / mobile native client wraps the same surface; this spec is for the web app.

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ TopBar (Calendar)                                               │
├──────────┬──────────────────────────────────────────────────────┤
│          │                                                      │
│ Sidebar  │  Calendar grid (day / week / month)                  │
│  - Mini  │                                                      │
│  - Sources│                                                     │
│  - Filters│                                                     │
└──────────┴──────────────────────────────────────────────────────┘
```

- Default view: **Week** (7 days × 24 hours).
- Other views: **Day**, **Month**, **Schedule** (vertical agenda list).
- View switcher and date navigator in the TopBar.

## Sources

The sidebar lists:

- **Personal calendars** — Google / iCloud / Microsoft accounts the user has connected (OAuth).
- **Notion databases** — connected databases; user picks one or more date properties per DB to drive event placement.
- **Holidays** — country-pickable optional layer.

Each source has a colour swatch and on/off toggle. Connected calendars are read/write where the provider supports it; database-derived events are read/write as well (creating an event in the calendar creates a row in the database with that date).

## Events

- Click empty space → quick-create modal (title, time, source dropdown). The source determines where the event materialises.
- Drag to move; drag edge to resize duration.
- Click an event → side panel with details and editing.
- Database-derived events expose the underlying page; "Open page" jumps to the editor.

## Integration with database Calendar view

- The Calendar app and the database Calendar view (per `docs/frontend/07-database-views.md#calendar-view`) render the same dataset for a given DB.
- Editing in one updates the other in real time via the standard realtime channel.

## Personal vs. work blocking

A user can enable "Show my personal events as busy" — personal events appear on the work calendar as opaque grey blocks without titles or descriptions, preserving privacy.

## Smart scheduling

- **Find a time**: pick attendees → the app suggests free slots across all of their calendars and on the user's working hours.
- **Working hours** per user (settings).

## Notifications

- 1-minute, 5-minute, 15-minute, 30-minute, 1-hour, 1-day before — configurable per event.
- Browser notifications + email + native push (mobile).

## Data model

```
calendar_connections (
  id uuid PK,
  user_id uuid,
  provider text CHECK in ('google','icloud','microsoft','notion_database'),
  external_account text,
  database_id uuid NULL,
  date_property_id uuid NULL,
  end_property_id uuid NULL,
  oauth_token_id uuid NULL,
  color text,
  enabled bool,
  created_at
)
```

## API

- `GET /v1/calendar/events?from=&to=&sources=` — merged event list across sources.
- `POST /v1/calendar/events` — create.
- `PATCH /v1/calendar/events/:id` — update; the route resolves to the source provider.
- `DELETE /v1/calendar/events/:id`.
- `GET /v1/calendar/sources` / `POST` / `DELETE` — manage source connections.
- `POST /v1/calendar/find_time` — body `{ attendees, duration, range }`; returns suggested slots.

## Tests

- Integration: create event in a connected DB source → assert row created with correct dates.
- Round-trip: edit an event provided by Google → reflected in the Google source within < 30s.
- Chaos: tokens expired, source provider rate-limited, malformed RRULE.
- Observability: every event mutation produces `calendar.event.<verb>` span with `source.provider`.
- Performance: month-view first paint with 200 events < 400ms.