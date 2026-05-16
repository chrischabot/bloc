# `bloc.charts`

REST mapping: [`/v1/charts/evaluate`](../api/endpoints/charts.md).

## Types

```ts
interface ChartResult {
  object:       'chart_result';
  kind:         'bar' | 'line' | 'area' | 'scatter' | 'pie' | 'donut' | 'number';
  x_values:     string[];
  series:       Array<{ name: string; color?: string; values: Array<number | null> }>;
  scalar?:      number | null;
  total:        number;
  computed_at:  string;
}
```

## `bloc.charts.evaluate(config) → Promise<ChartResult>`

```ts
config: {
  kind: ChartResult['kind'];
  data_source: {
    database_id:  string;
    x_property?:  string;
    y_property?:  string;
    aggregation?: string;        // 'count' | 'sum' | 'avg' | 'min' | 'max' | 'median'
    group_by?:    string;
    filter?:      Record<string, unknown>;
  };
  style?: Record<string, unknown>;
}
```

For `kind: 'number'` the response carries a `scalar`; for everything else, `x_values` + `series`.
