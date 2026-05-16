# Buttons & Automations

Two related features share an action-engine substrate: **Buttons** (user-triggered) and **Database Automations** (event-triggered).

## Action engine — shared concepts

An automation is `(trigger) -> [step, step, step, ...]`. Steps are typed actions executed sequentially with an in-memory bag of variables.

### Supported action steps

| Step | Inputs | Effect |
|------|--------|--------|
| `add_page_to_database` | database, properties (templated), children | Inserts a new row |
| `edit_pages_in_database` | database, filter, property changes | Bulk update |
| `edit_property` | page id, property, new value | Updates a single property on the trigger page |
| `set_page_property` | page (templated), property, value | As above on any page |
| `send_slack_message` | channel, body, mentions | Slack integration |
| `send_email` | recipient, subject, body | Resend/SES |
| `send_notification` | recipients, body | Inbox notification |
| `open_page` | page id | (Buttons only) navigate the clicking user |
| `open_link` | URL | (Buttons only) open URL |
| `show_confirm` | message | (Buttons only) intermediate confirmation modal |
| `run_ai` | prompt, output_property | Calls the AI completion endpoint |
| `delay` | duration | Sleep before next step (automations only; up to 30 days) |

### Variable bag

- `now` — server timestamp at trigger.
- `actor` — user who triggered the button (Buttons only).
- `page` — the page that triggered (Automations only).
- `trigger.property` — for property-change triggers, the old/new value.
- Variables are referenced via `{{path.to.value}}` templating in any string input.

### Loops, conditions, branching (v1.1)

- v1 is linear (no if / loop). The schema accommodates a future `if`/`for_each` node — leave the AST extensible.

## Buttons

A **button** is a block type. Renders as a clickable pill (default), full-button, or icon button. Each button owns an action list.

### Block payload

```jsonc
{
  "type": "button",
  "button": {
    "label": "Add task",
    "icon": { "type":"emoji","emoji":"➕" } | null,
    "style": "default" | "outline" | "filled" | "icon",
    "color": "default" | "<19-color palette>",
    "steps": [ { "type":"add_page_to_database", ... }, ... ],
    "confirm": { "enabled": false, "message":"" }
  }
}
```

### Editor UI

- Click the button to fire it; **hover-click the gear icon** to edit.
- Editor:
  - Label + icon + style + color.
  - Step list (drag-reorder, delete, duplicate).
  - "+ Add step" opens a typed menu of step kinds.
  - Each step has its own collapsible form with type-specific inputs.
  - Save commits to `button.steps`.

### Runtime

- Click → `POST /v1/buttons/:block_id/invoke`.
- Server validates the actor permissions for every step's resource.
- Steps execute sequentially; failures abort and surface a toast.
- Steps emit per-step spans; the overall invocation is one parent span.

## Database Automations

Configured on a database via the database settings menu → **Automations**.

### Triggers

| Trigger | Description |
|---------|-------------|
| `page_added` | New row appended to the database |
| `page_property_changed` | Specified property changes |
| `page_property_meets` | Property meets a filter expression (any operator from `docs/api/schemas/filters.md`) |
| `time` | Cron-like recurrence (rate-limited; see below) |

### UI

- Database dropdown → **Automations** → list of automations.
- "+ New automation":
  - Name (defaults from first action).
  - **When** — pick trigger; for property triggers, choose property + condition.
  - **Do** — the same step editor as buttons.
- Each automation has on/off toggle, last-run timestamp, run count, and a recent-runs log.

### Execution

- Triggers handled in `apps/worker/src/jobs/run-automation.ts`.
- Events flow via Redis pub/sub `workspace:{id}:automation`.
- Worker fetches the page snapshot, runs steps, writes a run record to `automation_runs`.
- Idempotency: each invocation has an idempotency key `(automation_id, page_id, trigger_event_id)`.

### Rate-limit

- Automations: 1000 runs / workspace / day (Plus), 10 000 (Business), 100 000 (Enterprise).
- `time` triggers minimum interval: 15 minutes.
- Exceed → `automation_runs.status = 'rate_limited'`, audit event, warning toast on the next page open.

## Data model

```
buttons (
  id uuid PK, block_id uuid UNIQUE REFERENCES blocks(id),
  steps jsonb, confirm jsonb,
  created_by uuid, updated_at timestamptz
)
automations (
  id uuid PK, database_id uuid REFERENCES databases(id),
  name text, enabled bool DEFAULT true,
  trigger jsonb,        -- {kind, property_id?, schedule?}
  steps jsonb,
  created_by uuid, updated_at timestamptz,
  last_run_at timestamptz, runs_count int DEFAULT 0
)
automation_runs (
  id uuid PK, automation_id uuid,
  trigger_event_id text,
  status text CHECK in ('success','partial','failed','rate_limited'),
  steps_log jsonb,            -- per-step status + duration_ms
  started_at, ended_at timestamptz
)
```

## API

- `POST /v1/buttons/:block_id/invoke` — fires a button (any user with view on the page).
- `GET /v1/databases/:id/automations` / `POST` / `PATCH` / `DELETE` — CRUD automations.
- `GET /v1/automations/:id/runs` — paginated run log.

## Tests

- Unit: step executor per step type; template renderer; trigger compiler.
- Integration: each trigger fires an automation; expected mutations applied; idempotent on retry.
- Chaos: malicious template (`{{` injection), 1000-step button (capped at 50), action targeting a forbidden resource → 403.
- Observability: every step emits a span; every run emits an audit event.