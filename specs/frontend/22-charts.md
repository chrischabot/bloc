# Charts

A **chart** is either:

- A **chart view** of a database (`database_views.type = 'chart'`), or
- A standalone **chart block** that references a target database via a stored query.

Both share the same renderer.

## Chart kinds

| Kind | Geometry | Notes |
|------|----------|-------|
| `bar` | vertical bars | grouped or stacked |
| `column` | horizontal bars | same as bar with axes swapped |
| `line` | continuous line(s) | smoothing optional |
| `area` | stacked area | requires `group_by` |
| `donut` | ring with slices | single-series |
| `pie` | filled circle with slices | single-series |
| `scatter` | point cloud | (v1.1) |

## Configuration (per chart)

```jsonc
{
  "kind": "bar",
  "source": { "database_id": "uuid", "filter": { ... }, "sorts": [...] },
  "x_axis": {
    "property_id": "uuid",        // categorical or date
    "bucket": "day" | "week" | "month" | "quarter" | "year" | null
  },
  "y_axis": {
    "aggregation": "count" | "sum" | "avg" | "min" | "max" | "median" | "percent_empty" | "percent_not_empty",
    "property_id": "uuid|null"    // null only for 'count'
  },
  "group_by": { "property_id": "uuid|null" } | null,
  "color_scheme": "default" | "warm" | "cool" | "rainbow" | "category10" | "<custom palette id>",
  "legend": { "position": "top" | "right" | "bottom" | "none" },
  "show_tooltips": true,
  "show_data_labels": false,
  "show_grid": true,
  "y_axis_zero_anchored": true
}
```

## Configuration UI

A right-side configurator opens on chart creation and via the gear icon:

- **Source** — DB picker (only DBs in the workspace), with inline filter builder.
- **Mark** — chart kind chips (bar, column, line, area, donut, pie).
- **X axis** — property dropdown; if date, bucket selector appears.
- **Y axis** — aggregation + property picker.
- **Group by** — optional second-axis split.
- **Color** — palette selector.
- **Display** — legend, tooltips, data labels, grid.

Live preview re-renders on each change.

## Block payload (standalone chart block)

```jsonc
{
  "type": "chart",
  "chart": {
    "config": <as above>,
    "title": "Tasks per week",
    "description": [ /* rich text */ ]
  }
}
```

Renders as a card with a title, axis-labelled chart, and a "View source" link to the underlying database.

## Renderer

- Built on `visx` for SVG primitives.
- Responsive — re-renders at the container's measured width on resize.
- A11y: each chart exposes a `<table>` fallback (visually hidden) with the underlying numbers; aria-label summarises the chart.

## Data engine

- Compile config → SQL via `packages/db/src/chart-engine.ts`:
  - Categorical axis → `GROUP BY`.
  - Date axis with bucket → `date_trunc(<bucket>, …)`.
  - Aggregation maps to SQL aggregate; `percent_*` computed in two passes.
- Result rows ≤ 1000 by default; over 1000 → top-N truncation with a "+ N more" footer note.
- Caching: results cached in Redis for 60s keyed by `hash(config)`.

## Tests

- Unit per chart kind: golden fixture configs produce golden output arrays.
- Visual: each chart kind in light + dark; truncated dataset.
- Chaos: malformed config (unknown aggregation, property mismatch), oversized result (1M rows → graceful truncation), formula-axis (must eval in Node).
- Performance: chart render < 250 ms for 1k-point series.