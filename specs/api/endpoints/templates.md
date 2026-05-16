# Templates Endpoints

See `docs/frontend/28-templates.md`.

## Workspace templates gallery

### `GET /v1/templates`

Query: `category`, `q`, `start_cursor`, `page_size`.

**Response**:
```jsonc
{
  "object":"list","type":"template",
  "results":[ { "id":"...","title":"...","category":"work","author":"notion","cover":"...","summary":"..." } ],
  "next_cursor":"...|null","has_more":...,"template":{}
}
```

### `POST /v1/templates/{template_id}/duplicate`

Body: `{ "workspace_id":"uuid", "parent": { "type":"page_id"|"workspace", ... } }`.

**Response**: `{ "page_id":"<new>" }`.

## Database templates

### `POST /v1/databases/{database_id}/templates`

Body: an optional initial body (`children: Block[]`) and `properties` map. Returns a `Page` with `is_template: true`.

### `GET /v1/databases/{database_id}/templates`

List templates (paginated). Excludes regular rows.

### `PATCH /v1/databases/{database_id}/default_template`

Body: `{ "template_id":"uuid|null" }`.

## Recurring templates

### `POST /v1/templates/{template_id}/recurrence`

Body:
```jsonc
{
  "frequency": { "kind":"weekly", "days":["mon","wed","fri"] }
                | { "kind":"daily" }
                | { "kind":"monthly", "day_of_month":1 }
                | { "kind":"monthly", "nth":2, "weekday":"tue" }
                | { "kind":"yearly", "month":1, "day":1 }
                | { "kind":"cron", "cron":"0 9 * * 1-5" },
  "run_at_time":"09:00",
  "timezone":"Europe/London",
  "start_date":"2026-06-01",
  "end": { "kind":"never" } | { "kind":"after_n","value":12 } | { "kind":"on_date","value":"2027-01-01" }
}
```

**Response**: the `recurring_template` object including `next_run_at`.

### `PATCH /v1/recurring_templates/{id}` / `DELETE`

### `GET /v1/recurring_templates/{id}/runs`

List recent recurrence executions.

## Tests

- Contract: every recurrence shape + the duplicate flow.
- Chaos: recurrence at impossible date (Feb 30) → 400; recurrence start in the past 5y (catches up by 1, not back-fills).
- Observability: each `recurring_template.run` span carries `template_id`, `database_id`, `created_page_id`.