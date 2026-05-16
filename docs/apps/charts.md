# Charts

Insert a chart block via `/chart`. Bind to any database; configure aggregation, x/y, group-by.

## Kinds

| Kind | Use for |
|---|---|
| `bar` | Counts by category |
| `line` | Trends over time |
| `area` | Trends with magnitude |
| `scatter` | Two numeric properties |
| `pie` / `donut` | Composition of a small set |
| `number` | Single KPI scalar |

## API

```ts
const chart = await bloc.charts.evaluate({
  kind: 'bar',
  data_source: {
    database_id,
    x_property: 'Status',          // bucketing axis
    aggregation: 'count',
    group_by: 'Owner',             // produces one series per group value
    filter: { property: 'Done at', date: { past_month: {} } }
  },
  style: { bucket: 'week' }        // time bucketing when x is a date
});
```

Response:

```ts
{
  kind: 'bar',
  x_values: ['Open', 'In progress', 'Done'],
  series: [
    { name: 'Alice', color: '#3b82f6', values: [3, 7, 2] },
    { name: 'Bob',   color: '#10b981', values: [1, 4, 6] },
  ],
  total: 23,
  computed_at: '...'
}
```

## Caching

Results cache for 60 s per `(database_id, config_hash)`. Pass `style.cache: 'no'` to bypass — useful for live dashboards but expensive.

## Limits

- Max 12 distinct group-by values; beyond that, the rest are collapsed into "Other".
- Date bucketing supports `day` / `week` / `month` / `quarter` / `year`.
- Aggregations supported: `count`, `count_unique`, `sum`, `avg`, `min`, `max`, `median`, `percent_per_group`.
