# `bloc.versions`

REST mapping: [`/v1/pages/{id}/versions`](../api/endpoints/versions.md).

## Types

```ts
interface PageVersion {
  object:        'page_version';
  page_id:       string;
  clock:         number;
  created_at:    string;
  update_bytes:  number;
}

interface PageVersionSnapshot {
  object:                'page_version_snapshot';
  page_id:               string;
  clock:                 number;
  created_at:            string;
  update_bytes:          number;
  updates_through_clock: number;
  recordMap:             Record<string, unknown>;
  notes:                 string[];
}
```

## `bloc.versions.list(args) → Promise<...>`

```ts
args: { page_id: string; page_size?: number; start_cursor?: string }
```

## `bloc.versions.retrieve(args) → Promise<PageVersionSnapshot>`

```ts
args: { page_id: string; clock: number }
```

Returns the page state at the specified clock as a `recordMap` you can pass to `<NotionRenderer/>`.
