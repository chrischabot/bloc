# Calendar

Two related surfaces:

1. A **calendar view** on a database — visualises rows on a calendar grid based on a date property.
2. The **Calendar app** — a unified, workspace-wide calendar that aggregates date properties across databases and (optionally) external calendars via Connections.

## Calendar view (per-database)

- Open the database → add view → **Calendar**.
- Pick a date property as the anchor.
- Switch between month / week / day layouts.

Dragging an event shifts the date property; resizing changes the end date (if the property is a date range).

## Calendar app

The dedicated workspace-level view at **Home → Calendar** (or the calendar icon in the sidebar). It shows:

- Every database row across the workspace that has a date property the user can read.
- Events from connected external calendars (Google Calendar etc.) — read-only unless the connection has write scope.
- Reminders.
- Scheduled automations (admin only).

Toggle sources from the left panel. Each source has its own color.

## Connecting an external calendar

**Settings → Connections → Add → Google Calendar** (or other provider). OAuth dance; once connected, your events appear in the calendar app.

## Timezones

All times are stored in UTC. Display TZ defaults to the user's browser; override per-account in **Settings → Preferences**.

For all-day events, the date is stored without a time component (`"2025-05-16"`) and rendered in the viewer's local TZ.
