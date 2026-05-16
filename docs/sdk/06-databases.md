# `bloc.databases`

REST mapping: [`/v1/databases`](../api/endpoints/databases.md).

## Types

```ts
interface DatabaseObject {
  object:           'database';
  id:               string;
  parent:           Record<string, unknown>;
  created_time:     string;
  last_edited_time: string;
  title:            unknown;
  description:      unknown;
  properties:       Record<string, unknown>;
  url:              string;
  archived:         boolean;
  in_trash:         boolean;
  is_inline:        boolean;
  public_url:       string | null;
  [key: string]:    unknown;
}

interface DatabaseQueryResponse {
  object:      'list';
  type:        'page_or_database';
  results:     Array<Record<string, unknown>>;
  next_cursor: string | null;
  has_more:    boolean;
}
```

## `bloc.databases.create(args) → Promise<DatabaseObject>`

```ts
args: {
  parent:       Record<string, unknown>;
  title?:       unknown[];                   // RichText[]
  description?: unknown[];                   // RichText[]
  icon?:        unknown;
  cover?:       unknown;
  is_inline?:   boolean;
  properties:   Record<string, { type: string; [key: string]: unknown }>;
}
```

## `bloc.databases.retrieve(args) → Promise<DatabaseObject>`

```ts
args: { database_id: string }
```

## `bloc.databases.update(args) → Promise<DatabaseObject>`

```ts
args: { database_id: string } & Record<string, unknown>
```

Use for title/description/icon/cover changes, archival, and schema mutations (`properties: { Status: { name: 'Stage' } }` to rename, `properties: { Status: null }` to remove).

## `bloc.databases.query(args) → Promise<DatabaseQueryResponse>`

```ts
args: {
  database_id:   string;
  filter?:       Record<string, unknown>;            // see schemas/filters.md
  sorts?:        Array<Record<string, unknown>>;     // see schemas/sorts.md
  start_cursor?: string;
  page_size?:    number;
}
```

## Example: query all rows

```ts
async function* allRows(database_id: string) {
  let cursor: string | undefined;
  do {
    const page = await bloc.databases.query({
      database_id,
      page_size: 100,
      start_cursor: cursor,
    });
    yield* page.results;
    cursor = page.has_more ? page.next_cursor! : undefined;
  } while (cursor !== undefined);
}
```
