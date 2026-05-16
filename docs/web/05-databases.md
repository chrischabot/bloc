# Databases

A database is a special page whose children are rows with structured properties. Each row is itself a page (with its own block tree).

## Creating

- `/table`, `/board`, `/list`, `/gallery`, `/calendar`, `/timeline` create an **inline** database (sits in the current page).
- New full-page database from the sidebar `+` menu → "Database" → choose initial view.

## Properties (columns)

Click `+ Add property` at the right end of the header row (table view) or in the property panel (any view). The property type picker shows all 23 types. See [API › Property types](../api/schemas/property-types.md) for the full schema reference.

To rename: click the column header, edit name.
To configure: click the column header, "Edit property" — change type, format, options, etc.
To remove: column header menu → "Delete property".

## Views

Each view has:

- A **layout** (table / board / list / gallery / calendar / timeline).
- A **filter** (one or more leaf predicates joined by `and` / `or`).
- A **sort** (ordered list of property+direction).
- A **group-by** (board, list, gallery).
- A **calendar by** (calendar view — which date property to anchor on).
- A **timeline by** (timeline view — start + end date properties).
- A **visible properties** list with widths and order.

Switch views via the tabs at the top of the database. Add views with the `+`.

## Filters

Click "Filter" at the top of the view. Pick a property → operator → value. Compound filters: group with "And" / "Or". See [API › Filters](../api/schemas/filters.md) for the operator catalogue.

## Sorts

Click "Sort". Multi-key sorts are evaluated top-to-bottom — earlier keys take priority.

## Grouping

Board, list, gallery views can group by:

- A `select` / `multi-select` / `status` / `people` / `relation` / `checkbox` / `date` (bucketed by day/week/month) property.

Boards have one group per column; cards drag between columns to set the property value.

## Linked views

A linked view shows the same database from a different page. Right-click a database row, "Copy link", paste in another page → asks if you want a link or a linked view. Linked views can have their own filter/sort/visible-properties without affecting the source.

## Templates

Per-database row template. Click `New ▾` → "+ New template". Configure the row's block tree once; from then on `New` offers your templates as starting points.

## Subitems & dependencies

Configurable on a per-database basis:

- **Sub-items** — adds a self-relation column `Parent → Sub-items`. Rows nest.
- **Dependencies** — adds two relations `Blocked by` / `Blocking`. Used by timeline view to draw arrows.

## Forms

See [Sites & forms](./11-sites.md#forms) — every database can have one or more form views configured for public submission.

## Charts

Insert a chart block (`/chart`) → bind to any data source — see [Charts](../api/endpoints/charts.md) for the configuration shape.

## Automations

Database settings → Automations. See [API › Automations](../api/endpoints/automations.md).
