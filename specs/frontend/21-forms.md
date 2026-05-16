# Forms

A form is a publicly or workspace-scoped data-entry surface backed by a target database. Submissions become rows in that database.

## Anatomy

A form belongs to one database and lives as a **view** of that database with `type = 'form'`. It has:

- A title and description.
- A field list (mirrors database properties; subset + ordered).
- A submit button label.
- A confirmation message and an optional redirect URL.
- A submission policy: who can submit (`anyone with the link`, `workspace members`, `specific people`).
- An optional limit (single submission per user; total cap; close at date).

## Form editor

Open from the database → **+ Add view** → **Form**.

UI:

- Left pane: preview rendered as users will see it.
- Right pane: settings tabs — **Fields**, **Design**, **Logic**, **Sharing**, **Submissions**.

### Fields tab

- Drag-reorder; per-field toggles:
  - **Required** (overrides database default).
  - **Label override** (display label distinct from property name).
  - **Help text**.
  - **Default value**.
- Add a field → choose from database properties not yet shown; or "Create new property" creates one inline.
- Form-only fields (deferred to v2) — fields collected on submission but not persisted as properties; persisted as a JSON blob on the row.

### Design tab

- Cover, icon, brand color, font.
- Logo upload (max 256 KB).

### Logic tab (v1.1; out of scope in v1)

- Conditional show / hide based on previous answer (reserve schema fields).

### Sharing tab

- Public URL toggle (uses `notion.site` or custom domain like Sites).
- Workspace-only toggle.
- Embed code (iframe snippet).
- Submission policy controls.

### Submissions tab

- Live list of submissions (rows in the database) with timestamp, submitter, IP (workspace-only forms).
- "Open in database" button.

## Field type → input renderer

| Property type | Input |
|---------------|-------|
| `title`, `rich_text` | single-line / multi-line text input |
| `number` | numeric input |
| `select`, `status` | radio list (≤ 5 options) or dropdown |
| `multi_select` | checkbox list (≤ 8 options) or pill multi-select |
| `date` | date picker; time toggle |
| `people` | searchable people picker (workspace-only forms) |
| `files` | file upload widget; multi-file allowed |
| `checkbox` | single checkbox |
| `url`, `email`, `phone_number` | typed text with validation |
| `relation` | searchable picker of pages in the target DB |
| `formula`, `rollup`, `created_*`, `last_edited_*` | not selectable for forms |

## Submission

- `POST /v1/forms/:form_id/submissions` — body matches the field list.
- Anti-abuse:
  - Cloudflare Turnstile token validation when `anyone with the link`.
  - Rate-limit per IP: 60 / hour / form.
  - File-upload AV scan optional.
- Server creates a row in the target database with the submitted values.
- Side effects: any `page_added` automations on the target database fire.
- Response: `{ row_id, redirect_url? }`.

## Public form page

- Route: `<workspace>.notion.site/forms/<form-id>` or `<custom-domain>/forms/<slug>`.
- Renders the form with workspace branding.
- After submit → confirmation message or redirect.

## Data model

`database_views.type` gains `'form'`. Additional form metadata stored in `database_views.config` as:

```jsonc
{
  "kind": "form",
  "title": "...",
  "description": "...",
  "fields": [
    { "property_id": "...", "required": true, "label_override":"", "help":"", "default": ... }
  ],
  "submit_label": "Submit",
  "confirmation": { "message":"Thanks!", "redirect_url": null },
  "policy": "public" | "workspace" | "people",
  "single_submission_per_user": false,
  "max_submissions": null,
  "close_at": null,
  "design": { ... }
}
```

## API

- `POST /v1/databases/:id/views` with `type=form` and `config` as above.
- `PATCH /v1/database_views/:id` to update.
- `POST /v1/forms/:id/submissions` (public).
- `GET /v1/database_views/:id/submissions` (workspace).

## Tests

- E2E: anonymous submission lands a row; non-required field omitted produces null; required missing returns 400.
- Visual: form page in light + dark; embedded iframe.
- Chaos: submission flood, oversized files, missing turnstile token, hostile redirect URL — all 4xx.
- Observability: submissions span carries `form.id`, `database.id`, `submission.id`.