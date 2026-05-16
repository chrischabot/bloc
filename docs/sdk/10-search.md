# `bloc.search`

`bloc.search` is exposed as a top-level method on the `Bloc` instance (not under a namespace).

## Types

```ts
interface SearchResponse {
  object:      'list';
  type:        'page_or_database';
  results:     Array<Record<string, unknown>>;
  next_cursor: string | null;
  has_more:    boolean;
}
```

## `bloc.search(args?) → Promise<SearchResponse>`

```ts
args: {
  query?:        string;
  sort?:         { direction: 'ascending' | 'descending'; timestamp: 'last_edited_time' };
  filter?:       { value: 'page' | 'database'; property: 'object' };
  page_size?:    number;
  start_cursor?: string;
}
```

All fields optional. Defaults to recent pages and databases.

## Examples

```ts
const recent = await bloc.search();                       // recently edited
const pages  = await bloc.search({ filter: { property: 'object', value: 'page' } });
const found  = await bloc.search({ query: 'OKRs', page_size: 20 });
```
