# Data model

Bloc's data model mirrors Notion's: every object is a JSON document with a discriminator (`object`), an id, a parent, audit fields, and a type-specific payload.

## Hierarchy

```
Workspace
 ├── Page                ← a tree of blocks
 │    ├── Block          ← paragraph / heading / image / …
 │    │    └── Block     ← (recursive)
 │    └── Comment
 ├── Database            ← a special page whose children are pages with structured properties
 │    ├── DataSource     ← one or more, owned or linked
 │    ├── Page (row)
 │    │    └── Property values
 │    └── View           ← table / board / list / gallery / calendar / timeline
 ├── User
 ├── Group / Teamspace
 ├── Webhook
 ├── Integration
 └── Sites publication
```

## Core objects

### `Page`

```ts
{
  object: 'page',
  id: 'uuid',
  parent: { type: 'workspace' | 'page_id' | 'database_id', ... },
  created_time: ISO8601,
  last_edited_time: ISO8601,
  created_by: { object: 'user', id },
  last_edited_by: { object: 'user', id },
  archived: boolean,
  in_trash: boolean,
  icon: { type: 'emoji' | 'file' | 'external', ... } | null,
  cover: { type: 'file' | 'external', ... } | null,
  properties: { [name]: PropertyValue },
  url: string,
  public_url: string | null,
}
```

A page is both a node in the tree **and** a database row when its parent is a `database_id`. The `properties` object then holds the row's column values.

### `Block`

```ts
{
  object: 'block',
  id: 'uuid',
  type: 'paragraph' | 'heading_1' | … | 'child_page' | 'child_database',
  parent: { type: 'page_id' | 'block_id' | 'database_id', ... },
  has_children: boolean,
  archived: boolean,
  in_trash: boolean,
  created_time: ISO8601,
  last_edited_time: ISO8601,
  created_by, last_edited_by,
  [type]: { /* type-specific payload */ }
}
```

The type field is its own discriminator and gates the shape of the `[type]` key. See [API › Block types](../api/03-block-types.md) for the full schema per type.

### `Database`

```ts
{
  object: 'database',
  id: 'uuid',
  parent: { type, ... },
  title: RichText[],
  description: RichText[],
  properties: { [name]: PropertySchema },
  is_inline: boolean,
  archived: boolean,
  in_trash: boolean,
  url: string,
  public_url: string | null,
  created_time, last_edited_time, ...
}
```

The `properties` object on a database is the **schema** (what columns exist, what type each is). The `properties` object on a database row (a page whose parent is the database) is the **values**.

### `DataSource`

A data source is the unit a view queries. By default every database has one **owned** data source; you can attach more (or **linked** ones pointing at another database's data source) — that's how the same underlying rows can show up in multiple databases without duplication.

### `User`

```ts
{
  object: 'user',
  id,
  type: 'person' | 'bot',
  name: string | null,
  avatar_url: string | null,
  person?: { email },
  bot?: { owner, workspace_name },
}
```

### `Comment`

Comments hang off either a page or a block and are grouped into **discussions**. Comments can carry reactions. A discussion resolves when someone calls `POST /v1/comments/{id}/resolve`.

### `Permission`

Per-page ACL row. Grantees can be a `user`, `workspace`, `teamspace`, `group`, `public` (anyone), or `link` (anyone with the link). Levels: `full_access`, `can_edit`, `can_edit_content`, `can_comment`, `can_read`, `no_access`.

## Property types

The 23 supported property types:

| Type | Value shape |
|---|---|
| `title` | `RichText[]` |
| `rich_text` | `RichText[]` |
| `number` | `number \| null` |
| `select` | `{ id, name, color } \| null` |
| `multi_select` | `Array<{ id, name, color }>` |
| `status` | `{ id, name, color } \| null` |
| `date` | `{ start, end?, time_zone? } \| null` |
| `people` | `User[]` |
| `files` | `Array<{ name, file | external }>` |
| `checkbox` | `boolean` |
| `url` | `string \| null` |
| `email` | `string \| null` |
| `phone_number` | `string \| null` |
| `formula` | `{ type: 'string'|'number'|'boolean'|'date', ... }` |
| `relation` | `Array<{ id }>` |
| `rollup` | `{ type, function, ... }` |
| `created_time` | ISO8601 |
| `created_by` | `User` |
| `last_edited_time` | ISO8601 |
| `last_edited_by` | `User` |
| `unique_id` | `{ prefix?, number }` |
| `verification` | `{ state, verified_by?, date? }` |
| `button` | `{}` |

Property *schema* shapes (database side) and property *value* shapes (page side) are documented at [API › Property types](../api/04-property-types.md).

## Rich text

Bloc's `RichText` is identical to Notion's. Each run is one of:

```ts
{ type: 'text',     text: { content, link? },        annotations, plain_text, href }
{ type: 'mention',  mention: { type: 'user'|'page'|'database'|'date'|'link_preview'|'template_mention', ... } }
{ type: 'equation', equation: { expression } }
```

`annotations` are the styling bits: `bold`, `italic`, `strikethrough`, `underline`, `code`, `color`.

## Identifiers

All ids are UUID v4. The public API accepts both `dashed-form` and `nodashesform`; responses always use the dashed form. There is no separate "short id" form.

## Timestamps

All timestamps are ISO 8601 with milliseconds, UTC. `created_time`, `last_edited_time` are server-controlled.

## Soft delete

`DELETE` operations on pages, blocks, and databases set `archived: true` and `in_trash: true` — they don't drop rows. To permanently remove a page after archival, call `DELETE /v1/pages/{id}?permanent=true`. The 30-day trash retention policy is a worker job; uncomfigurable in v1.

## Next

- [APIs at a glance](./04-apis-at-a-glance.md) for which surface to call.
- [API reference](../api/README.md) for the wire shape of every endpoint.
