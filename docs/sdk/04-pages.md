# `bloc.pages`

REST mapping: [`/v1/pages`](../api/endpoints/pages.md).

## Types

```ts
interface PageObject {
  object:           'page';
  id:               string;
  parent:           Record<string, unknown>;
  created_time:     string;
  last_edited_time: string;
  created_by:       { object: 'user'; id: string };
  last_edited_by:   { object: 'user'; id: string };
  archived:         boolean;
  in_trash:         boolean;
  icon:             unknown;
  cover:            unknown;
  properties:       Record<string, unknown>;
  url:              string;
  public_url:       string | null;
}

interface PropertyItem {
  object: 'property_item';
  id:     string;
  type:   string;
  [key: string]: unknown;
}
```

## `bloc.pages.create(args) → Promise<PageObject>`

```ts
args: {
  parent:     Record<string, unknown>;       // { workspace: true } | { page_id } | { database_id }
  properties?: Record<string, unknown>;      // property values keyed by name/id
  icon?:       Record<string, unknown> | null;
  cover?:      Record<string, unknown> | null;
  children?:   Array<{ type: string; [key: string]: unknown }>;
}
```

Maps to `POST /v1/pages`.

## `bloc.pages.retrieve(args) → Promise<PageObject>`

```ts
args: { page_id: string }
```

Maps to `GET /v1/pages/{page_id}`.

## `bloc.pages.update(args) → Promise<PageObject>`

```ts
args: { page_id: string } & Record<string, unknown>
```

Pass `{ page_id, properties: { ... } }` to patch property values, or `{ page_id, archived: true }` to archive. Maps to `PATCH /v1/pages/{page_id}`.

## `bloc.pages.delete(args) → Promise<PageObject | undefined>`

```ts
args: { page_id: string; permanent?: boolean }
```

Soft-archives by default. With `permanent: true`, hard-deletes an *already archived* page; the server returns `204`, so the SDK resolves to `undefined`. Maps to `DELETE /v1/pages/{page_id}[?permanent=true]`.

## `bloc.pages.properties.retrieve(args) → Promise<PropertyItem>`

```ts
args: { page_id: string; property_id: string }
```

Maps to `GET /v1/pages/{page_id}/properties/{property_id}`.

## Examples

### Create a row in a database

```ts
await bloc.pages.create({
  parent:     { database_id: DB_ID },
  properties: {
    Name:   { title: [{ text: { content: 'Fix login' } }] },
    Status: { status: { name: 'To do' } },
    Owner:  { people: [{ id: USER_ID }] }
  }
});
```

### Archive then permanently delete

```ts
await bloc.pages.delete({ page_id });                // archived: true
await bloc.pages.delete({ page_id, permanent: true }); // dropped
```
