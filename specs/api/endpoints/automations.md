# Buttons & Automations Endpoints

See `docs/frontend/20-buttons-automations.md` for product behaviour. Action schemas are in `docs/api/schemas/automation-actions.md`.

## Buttons

### `POST /v1/buttons/{block_id}/invoke`

Fire a button. Returns the per-step run log.

**Body** (optional):
```jsonc
{ "context": { "<var>": <any> } }   // injected into the variable bag
```

**Response** (200):
```jsonc
{
  "object": "automation_run",
  "id": "uuid",
  "button_block_id": "uuid",
  "status": "success" | "partial" | "failed",
  "steps": [
    { "index": 0, "type": "add_page_to_database", "status": "success", "duration_ms": 31, "output": { "page_id": "..." } }
  ],
  "started_at": "...",
  "ended_at": "..."
}
```

**Errors**: 401, 403 (no permission on a step's target), 422 (step misconfigured), 429.

### Reading the button config

Buttons live inside a block. Use `GET /v1/blocks/:id` and inspect the `button` payload. To edit, `PATCH /v1/blocks/:id` with a new `button` payload.

## Database automations

### `GET /v1/databases/{database_id}/automations`

List automations on a database.

**Response** (200):
```jsonc
{
  "object": "list", "type": "automation",
  "results": [
    {
      "object": "automation",
      "id": "uuid",
      "database_id": "uuid",
      "name": "Notify on done",
      "enabled": true,
      "trigger": { "kind": "page_property_changed", "property_id": "...", "to": { "status": { "equals": "Done" } } },
      "steps": [ ... ],
      "last_run_at": "...",
      "runs_count": 142
    }
  ],
  "next_cursor": null,
  "has_more": false,
  "automation": {}
}
```

### `POST /v1/databases/{database_id}/automations`

Create an automation.

**Body**:
```jsonc
{
  "name": "Notify on done",
  "trigger": { "kind": "page_property_changed", "property_id": "...", "to": { ... } },
  "steps": [ { "type": "send_slack_message", "channel": "#proj", "body": "{{page.title}} is done." } ],
  "enabled": true
}
```

**Response** (200): the created `automation` object.

### `PATCH /v1/automations/{id}`

Partial update.

### `DELETE /v1/automations/{id}`

### `GET /v1/automations/{id}/runs`

List paginated runs (newest first).

### `POST /v1/automations/{id}/runs:test`

Dry-run an automation against a sample page; returns the per-step log without applying side effects (writes are flagged `would_apply`).

## Triggers

| `kind` | Extra fields |
|--------|--------------|
| `page_added` | none |
| `page_property_changed` | `property_id`, optional `to` filter (any operator from `docs/api/schemas/filters.md`) |
| `page_property_meets` | `property_id`, `condition` (filter operator) |
| `time` | `cron` (5-field UTC), optional `timezone` |

## Test obligations

- Contract per step and per trigger.
- SDK-progressive: `client.automations.list/create/update/delete/test`, `client.buttons.invoke`.
- Chaos: oversized step counts (>50), templating injection (`{{__proto__}}`), action targeting forbidden resource (403), invalid cron, cycle-induced infinite loops (cap recursion depth at 5).
- Observability: every run produces a parent `automation.run` span with child `automation.step` spans tagged by step type + status.
- Benchmark: 5-step button invoke p99 < 300ms; automation worker throughput ≥ 50 runs/s on a 2-core worker.