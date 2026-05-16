# Automations & buttons

Automations are per-database triggers; buttons are blocks that fire an automation on click.

## Automations

### List

`GET /v1/databases/{database_id}/automations`

### Create

`POST /v1/databases/{database_id}/automations`

```json
{
  "name": "Notify on stage change",
  "trigger": {
    "type": "page_property_changed",
    "property": "Status",
    "to": "Done"
  },
  "steps": [
    { "type": "send_webhook", "url": "..." },
    { "type": "update_property", "property": "Done at", "value": { "date": { "start": "now()" } } }
  ],
  "enabled": true
}
```

Response:

```json
{
  "object": "automation",
  "id": "uuid",
  "database_id": "uuid",
  "name": "...",
  "enabled": true,
  "trigger": { ... },
  "steps": [ ... ],
  "last_run_at": null,
  "runs_count": 0,
  "created_time": "...",
  "last_edited_time": "..."
}
```

### Update

`PATCH /v1/automations/{automation_id}`

Patch any of `name`, `trigger`, `steps`, `enabled`.

### Delete

`DELETE /v1/automations/{automation_id}` → `204`.

### Test

`POST /v1/automations/{automation_id}/runs:test`

```json
{ "sample_page_id": "uuid", "context": { ... } }
```

Returns an `automation_run` describing what each step did without persisting effects against `runs_count`. Useful before enabling.

## Buttons

A button block lives inside a page and invokes a configured automation.

### Invoke

`POST /v1/buttons/{block_id}/invoke`

```json
{ "context": { /* arbitrary */ } }
```

Returns an `automation_run`.

## Trigger types

| Type | Fires when |
|---|---|
| `page_created` | New row in the database |
| `page_property_changed` | Specified property changes (optionally to/from a value) |
| `page_property_within_offset` | Property is within `offset` of `now()` (for date properties) |
| `button_clicked` | Manual via button block |
| `scheduled` | Cron-like `schedule: "0 9 * * *"` in workspace TZ |

## Step types

| Type | Notes |
|---|---|
| `update_property` | Sets a property on the trigger page (or `target_page_id`) |
| `add_child_block` | Append blocks under a target page |
| `send_webhook` | POST JSON to a URL |
| `send_email` | SMTP with templated subject/body |
| `create_page` | Create a row in another database |
| `ai_completion` | Call `/v1/ai/completions` with a prompt template |
| `wait` | `seconds: N` — useful for chained effects |

Steps run sequentially; if one fails, subsequent steps with `on_error: "skip"` continue, otherwise the run is marked `failed`.

## Run history

Run history is currently retained on the `automations` table aggregate (`runs_count`, `last_run_at`). For per-run audit, use the audit log (`/v1/workspaces/me/audit?action=automation.ran`).
