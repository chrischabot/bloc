# Database Views

A database exposes its rows through one of six views: **table**, **board**, **gallery**, **list**, **calendar**, **timeline**. Each view persists in `database_views` (see data model).

## View frame (shared)

- View tabs across the top of the database (mini secondary tab bar):
  - Each tab: name + view-type icon + chevron (settings menu).
  - "+ Add view" at the end.
- Toolbar (under tabs):
  - Filter (button) — opens filter builder.
  - Sort (button) — opens sort list.
  - Group by (when applicable).
  - Properties (button) — visibility + order.
  - Search (icon button) — opens an inline search input filtering rows by title.
  - New (split button) — Quick add row; chevron lets pick template.
- View settings menu (per tab):
  - Rename
  - Duplicate
  - Delete
  - Edit layout (per-type options)
  - Hide / lock view

## Table view

- Grid of columns. First column is always the title.
- Column header: name + type icon. Right-click → sort, filter, hide, duplicate property, edit type, delete.
- Resize: drag right edge of a header; persisted per-view.
- Row: hover → row highlight; expander chevron on left to open page peek.
- Cell editing: see `08-database-properties-ui.md` for per-type editors.
- Bottom of grid:
  - "+ New row" row.
  - Optional **summary row** showing per-column aggregations (sum, avg, count, etc.).

Layout settings:
- Show vertical lines / horizontal lines.
- Wrap cell text.
- Show page icon column.
- Open pages in: side peek / full page / center peek.

## Board (Kanban) view

- Columns grouped by a property (select, status, multi_select; for multi_select rows appear in every column whose value they contain).
- Group header: title + count.
- Cards: title + the configured visible properties; preview image if cover present.
- Drag a card to move between columns (mutates the group-by property).
- Add card: + button at top of a column.
- Hide / show columns toggle in the group-by config.
- Cards can be color-coded by another property (optional).

Layout settings:
- Card preview: none / cover / page content.
- Card size: small / medium / large.
- Show columns by: option order / count desc / count asc.

## Gallery view

- Grid of cards (responsive, min card width 240, max card width 320; auto-fit).
- Card: cover image (or preview) + title + visible properties.
- Drag to reorder.

Layout settings:
- Card preview: page cover / page content / file & media property.
- Card size, fit (cover vs contain), open as.

## List view

- Vertical list of rows; each row: title (large) + properties beside as small tags.
- Lightweight; ideal for nested databases inside a page.

## Calendar view

- Month grid; days numbered.
- A row spans the cells of a date-range property.
- Click a day → quick-add modal for a new row with that date.
- Click an event → opens the page in side peek.
- Header: month name + < / > navigation + "Today" button + month/week toggle.

Layout settings:
- Show by: month / week.
- Calendar date property selector (which date property drives placement).

## Timeline view

- Gantt-style horizontal time axis.
- Rows: each database row → bar across its date range.
- Zoom: hours / days / weeks / months / quarters / years.
- Drag bar to move; drag edge to resize; drag empty space to create.
- Optional grouping (rows grouped by a property).
- Optional side table panel (toggle): the table view rendered alongside the timeline.

Layout settings:
- Timeline date property.
- Show by: zoom level.
- Group by.
- Show table view: on / off.
- Separate start/end properties or single range.

## Filter, sort, group panels

See `08-database-properties-ui.md` for the inner UIs.

## View permissions (Notion's "locked" model)

- A view can be locked; locked views cannot be edited until unlocked.
- Lock includes properties shown, filters, sorts, layout.

## Tests

- Unit per view component: rendering with various group-bys and property visibility.
- Integration: switch views; persistence of filter/sort/visibility per view.
- Playwright: drag card across columns; drag timeline bar; create row from calendar.
- Visual snapshot per view per theme.
- Performance: 1000-row table p99 cell scroll < 16ms; board view with 10 columns × 100 cards p99 paint < 32ms.