# Reminders

A reminder is a workspace-local note that fires at `due_at`.

## Create

`POST /v1/reminders`

```json
{
  "parent": { "type": "page" | "block", "id": "uuid" },
  "due_at": "2025-05-20T09:00:00.000Z",
  "label":  "Follow up with finance",
  "user_id": "uuid"
}
```

`user_id` defaults to the bearer's user.

## List

`GET /v1/reminders?include_fired=false&page_size=50`

## Retrieve

`GET /v1/reminders/{reminder_id}`

## Fire (manual)

`POST /v1/reminders/{reminder_id}/fire`

Immediately marks the reminder as fired and emits the `reminder.fired` event.

## Delete

`DELETE /v1/reminders/{reminder_id}` → `204`.

## Scan due

`POST /v1/reminders/scan-due`

Admin-only. Returns the set of reminders with `due_at < now()` that haven't been fired yet. The worker calls this on a schedule; you usually don't call it directly.

```json
{
  "object": "list",
  "type": "reminder",
  "results": [ ... ],
  "next_cursor": null,
  "has_more": false,
  "now": "2025-05-16T22:00:00.000Z"
}
```
