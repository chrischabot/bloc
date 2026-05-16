# `bloc.dataSources`

REST mapping: [`/v1/databases/{id}/data_sources`, `/v1/data_sources`](../api/endpoints/data-sources.md).

## Types

```ts
interface DataSourceObject {
  object:        'data_source';
  id:            string;
  database_id:   string;
  name:          string;
  type:          'owned' | 'linked';
  linked_from:   { database_id: string; data_source_id: string } | null;
  archived:      boolean;
  created_time:  string;
  last_edited_time: string;
}

interface DataSourceQueryResponse {
  object:      'list';
  type:        'page_or_data_source';
  results:     Array<Record<string, unknown>>;
  next_cursor: string | null;
  has_more:    boolean;
}
```

## `bloc.dataSources.create(args) → Promise<DataSourceObject>`

```ts
args: {
  database_id:            string;
  name:                   string;
  type?:                  'owned' | 'linked';
  source_data_source_id?: string;
}
```

## `bloc.dataSources.listForDatabase(args) → Promise<...>`

```ts
args: { database_id: string }
```

## `bloc.dataSources.retrieve(args) → Promise<DataSourceObject>`

```ts
args: { data_source_id: string }
```

## `bloc.dataSources.update(args) → Promise<DataSourceObject>`

```ts
args: { data_source_id: string; name?: string; archived?: boolean }
```

## `bloc.dataSources.delete(args) → Promise<void>`

```ts
args: { data_source_id: string }
```

## `bloc.dataSources.query(args) → Promise<DataSourceQueryResponse>`

```ts
args: {
  data_source_id: string;
  filter?:        Record<string, unknown>;
  sorts?:         Array<Record<string, unknown>>;
  start_cursor?:  string;
  page_size?:     number;
}
```
