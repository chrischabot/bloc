# Databases & views

Databases are how Bloc structures collections of rows.

For the end-user UI, see [Web › Databases](../web/05-databases.md). This page covers the model, views, and how to build against them.

## Model

- **Database** — the schema (property definitions, default view, settings).
- **Data source** — the unit a view queries. By default there's one owned data source matching the database. Linked data sources let one database surface rows owned by another.
- **Row** — a `page` whose parent is the database. Its `properties` carry the column values.
- **View** — layout + filter + sort + group-by + visible-properties. Multiple views per database.

The 23 supported property types are documented in [API › Property types](../api/schemas/property-types.md).

## Querying

```ts
const rows = await bloc.databases.query({
  database_id,
  filter: {
    and: [
      { property: 'Status', status: { equals: 'In progress' } },
      { property: 'Due',    date:   { this_week: {} } },
    ]
  },
  sorts: [ { property: 'Priority', direction: 'ascending' } ],
  page_size: 100,
});
```

Filters and sorts have a rich operator catalogue — see [API › Filters](../api/schemas/filters.md) and [Sorts](../api/schemas/sorts.md).

## Linked data sources

Create a data source on database B that points at database A's data source — A's rows now appear in B. The same row can show up in many databases without duplication. Filters and sorts on the linked view are scoped to the linking database; the underlying rows are still owned by A.

```ts
await bloc.dataSources.create({
  database_id: B,
  name: 'Engineering rows from A',
  type: 'linked',
  source_data_source_id: A_DS_ID,
});
```

## Formulas

A formula property's value is computed at read time from other properties. See [API › Formulas](../api/schemas/formulas.md) for the language.

```ts
await bloc.databases.update({
  database_id,
  properties: {
    'Days open': { formula: { expression: 'dateBetween(now(), prop("Created"), "days")' } }
  }
});
```

## Relations & rollups

Relations link rows across databases. Rollups aggregate values across related rows.

Single-property vs dual-property:

- **Single** — A → B. Only A has the column.
- **Dual** — A ↔ B. Both sides have a mirrored column; editing one updates the other.

Rollups configure: which `relation` to traverse, which property on the target to aggregate, and which `function` (count / sum / avg / min / max / median / earliest_date / latest_date / show_original).

## Sub-items & dependencies

Per-database opt-in. Sub-items add a self-relation (`Parent ↔ Sub-items`); dependencies add `Blocked by` / `Blocking`. Timeline views render these as nested rows and dependency arrows respectively.

## Views in detail

| View | When to use |
|---|---|
| **Table** | Spreadsheet feel, lots of columns visible at once |
| **Board** | Kanban — group by `select` / `status` |
| **List** | Compact text-only |
| **Gallery** | Cards with cover images — for catalogues, swipe-style |
| **Calendar** | Date-anchored; month/week/day layouts |
| **Timeline** | Date-range anchored; Gantt-style |

Each view persists its own filter/sort/group/visibility config. Switching views never modifies the data.

## Charts

Insert a chart block (`/chart`). Configure data source, x/y properties, aggregation, group-by. See [API › Charts](../api/endpoints/charts.md).

## Automations

Triggered by row events (created, property changed, scheduled). See [Automations](./automations.md).

## Performance tips

- Pre-filter on indexed properties first. The `pages.properties` GIN index covers most filter shapes, but property *value* indexes (you can create them with `BLOC_INDEX_PROPERTIES_BY_NAME`) make lookups O(log N).
- Avoid `is_not_empty` on wide databases — it scans.
- For dashboards rendering many charts of the same data, hoist the database query once and compute charts client-side instead of calling `/v1/charts/evaluate` per chart.
