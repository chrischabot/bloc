# Home Dashboard

The **Home** surface is the user's per-workspace landing experience. It assembles a widget grid personalised to the user.

## Route

`/<workspaceSlug>/home`

## Layout

- Greeting block (top): "Good morning, Alice" + workspace icon.
- Widget grid: 2-column on `≥ lg`, 1-column on `< lg`. Drag-to-reorder.
- Each widget has a header (icon + title + overflow menu).

## Widgets

| Widget | Source | Configurable |
|--------|--------|--------------|
| **My tasks** | Pages where `Assignee = me` and (status is not Done) | choose DB, filter, sort, limit |
| **Recently visited** | last 10 pages opened | none |
| **Upcoming events** | calendar property of a DB the user picks | pick DB, date property |
| **Mentions** | inbox `mention` events not yet read | none |
| **Reminders** | reminder mentions due in the next 7 days | none |
| **Sub-pages** | direct children of workspace root the user can see | none |
| **Favourites** | the user's favourites list | none |
| **Custom database** | any DB view; renders as a mini view | pick DB + view |

## Customisation

- **+ Add widget** at bottom-right.
- Per-widget overflow menu: configure, hide, remove.
- Layout persists per user per workspace in `user_home_layouts` table.

## Data model

```
user_home_layouts (
  user_id uuid,
  workspace_id uuid,
  layout jsonb,           -- [{ id, kind, config, row, col, w, h }, ...]
  updated_at timestamptz,
  PK (user_id, workspace_id)
)
```

## API

- `GET /v1/home` — returns the user's layout + materialised widget data in a single response.
- `PATCH /v1/home/layout` — update the layout array.
- `POST /v1/home/widgets` / `DELETE /v1/home/widgets/:id` — add / remove widgets.

## Tests

- Unit: widget config validators.
- E2E: drag a widget; reorder; verify persistence across reloads.
- Visual: each widget at default config in light + dark.
- Performance: Home loads with all widgets in p99 < 600 ms (with 10 widgets, 100 rows aggregate).