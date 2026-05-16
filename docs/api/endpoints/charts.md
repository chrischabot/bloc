# Charts

`POST /v1/charts/evaluate`

```json
{
  "kind": "bar" | "line" | "area" | "scatter" | "pie" | "donut" | "number",
  "data_source": {
    "database_id":   "uuid",
    "x_property":    "Date",
    "y_property":    "Score",
    "aggregation":   "count" | "sum" | "avg" | "min" | "max" | "median",
    "group_by":      "Owner",
    "filter":        { ... }
  },
  "style": { /* free-form; UI uses it */ }
}
```

Response:

```json
{
  "object": "chart_result",
  "kind": "bar",
  "x_values": ["2025-W18", "2025-W19", "2025-W20"],
  "series": [ { "name": "Alice", "color": "#3b82f6", "values": [3, 4, 6] } ],
  "scalar":  null,
  "total":   13,
  "computed_at": "2025-05-16T22:00:00.000Z"
}
```

When `kind == 'number'` the response is a scalar — `scalar` is set, `x_values`/`series` are empty.

## Notes

- Charts evaluate against the same data the database query would; they respect ACL.
- Time-bucketing on `x_property` uses the database's TZ. Pass `style.bucket: "day" | "week" | "month"` to control granularity.
- Results are cached per `(database_id, config_hash)` for 60 s. Add `style.cache: "no"` to bypass.
