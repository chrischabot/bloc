# Chart Config Schema

Shared shape between chart views (`database_views.config`) and `chart` blocks (`blocks.content.chart.config`).

```ts
type ChartConfig = {
  kind: 'bar' | 'column' | 'line' | 'area' | 'donut' | 'pie' | 'scatter';
  source: {
    database_id: string;          // uuid
    filter?: FilterObject;        // docs/api/schemas/filters.md
    sorts?: SortObject[];         // docs/api/schemas/sorts.md
  };
  x_axis: {
    property_id: string;
    bucket?: 'day'|'week'|'month'|'quarter'|'year';
  };
  y_axis: {
    aggregation: 'count'|'sum'|'avg'|'min'|'max'|'median'|'percent_empty'|'percent_not_empty';
    property_id?: string;         // required unless aggregation === 'count'
  };
  group_by?: { property_id: string } | null;
  color_scheme?: 'default'|'warm'|'cool'|'rainbow'|'category10'|string; // string = custom palette id
  legend?: { position: 'top'|'right'|'bottom'|'none' };
  show_tooltips?: boolean;     // default true
  show_data_labels?: boolean;  // default false
  show_grid?: boolean;         // default true
  y_axis_zero_anchored?: boolean; // default true
};
```

Validation (`packages/shared/src/chart-config.ts`):

- `x_axis.bucket` valid only when the referenced property is `date` / `created_time` / `last_edited_time`.
- `y_axis.property_id` required unless `aggregation === 'count'`.
- `aggregation` must be valid for the y-axis property's type (e.g. `sum` requires `number`).

## Test obligations

- Round-trip every chart kind via the schema.
- Reject cross-type aggregations (`sum` on a `select`).
- Chaos: empty config, deeply nested filter > depth 2 (covered by filter validator), `property_id` referencing a property in another DB (422).