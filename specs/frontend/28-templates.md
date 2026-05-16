# Templates

Three template surfaces coexist:

1. **Workspace templates gallery** — a global catalogue of starter pages reachable from the sidebar footer.
2. **Database templates** — per-database "+ New from template" presets that pre-fill a row with a fixed body and property values.
3. **Recurring templates** — database templates that automatically create new rows on a schedule.

## Workspace templates gallery

Route `/<workspaceSlug>/templates`.

- Top: search input + category chips (Personal, Work, Engineering, Design, Marketing, Sales, …).
- Card grid: each card shows cover, title, author, "Get template" button.
- Clicking a card → detail page with full preview + "Duplicate into my workspace" CTA.
- Authors:
  - **Notion** — built-in catalogue maintained in `tools/templates/built-in/`.
  - **Community** — pages published publicly with `Allow duplicate as template` (see `docs/frontend/19-sites-publishing.md`).

## Database templates

Open from a database's "New" split button → chevron → **+ New template**.

- A template editor opens the would-be row as a regular page with a yellow banner "Template — edit this page to set the default".
- Body and property values defined here become the defaults for new rows from this template.
- Properties with `{{computed}}` tokens (e.g. `{{today}}` in a date) resolve at row-create time.

### Template data

Stored as rows in the database with `is_template = true`. They are excluded from the normal query results.

```
pages.is_template bool DEFAULT false
```

### Default template

Each database can mark one template as **default**: clicking "+ New" (not the chevron) uses it.

## Recurring templates

Open the template's row menu → **Set to repeat**.

Configuration:

- **Frequency**: Daily, Weekly (with day-of-week checkboxes), Monthly (`day of month` or `nth weekday`), Yearly, Custom (cron).
- **Run at** (local time + timezone).
- **Start date**.
- **End**: never / after N runs / on date.

At each scheduled run, the worker:

1. Duplicates the template subtree into the database.
2. Resolves `{{today}}` / `{{now}}` / `{{run_index}}` tokens.
3. Triggers any `page_added` automations.

### Data model

```
recurring_templates (
  id uuid PK,
  template_page_id uuid REFERENCES pages(id),
  frequency jsonb,        -- { kind: 'daily'|'weekly'|'monthly'|'yearly'|'cron', ... }
  run_at_time time,
  timezone text,
  next_run_at timestamptz,
  end_kind text,          -- 'never'|'after_n'|'on_date'
  end_value jsonb,
  runs_count int DEFAULT 0,
  enabled bool DEFAULT true,
  last_run_at timestamptz,
  created_by uuid
)
```

## "Duplicate as template" from published pages

When a published page allows duplication (per `docs/api/endpoints/sites.md`), the public renderer surfaces a "Duplicate" button. Clicking it:

- If signed in: copies the subtree into the user's selected workspace (workspace picker if multiple).
- If not signed in: prompts sign-in, then copies.

## API

- `GET /v1/templates` — workspace templates gallery (paginated; filter by `category`).
- `POST /v1/templates/{id}/duplicate` — copy into target workspace + parent page.
- `POST /v1/databases/{id}/templates` — create a database template (returns the underlying page id with `is_template=true`).
- `PATCH /v1/databases/{id}/default_template` — set the default.
- `POST /v1/templates/{id}/recurrence` / `PATCH` / `DELETE` — recurring config.

## Tests

- Integration: recurring template fires on a frozen clock; token interpolation correct.
- Chaos: recurrence with past start date (catches up by 1 run, not infinite); recurrence cycle (recurring template that triggers an automation that creates another recurring template — bounded by depth 1).
- Observability: every recurring run produces a `template.recurring.run` span; duplicate emits an audit event.