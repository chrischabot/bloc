# Data Model

This is the normative Postgres schema for the replica.

## Object catalogue

| Object | Purpose | Primary tables |
|--------|---------|----------------|
| Workspace | Top-level tenant | `workspaces` |
| User | Person or bot | `users`, `bot_users` |
| Membership | User ↔ workspace ↔ role | `workspace_members` |
| Page | A page (with or without database parent) | `pages`, `page_properties` |
| Database | A schema (collection of pages with a property set) | `databases`, `database_properties`, `database_views` |
| Block | A node in the page block tree | `blocks` |
| Comment | A comment attached to a page or block | `comments`, `discussions` |
| File | An uploaded file | `files` |
| Permission | Page/database ACL entries | `permissions` |
| AuditEvent | Append-only audit trail | `audit_events` |

## Tables

### `workspaces`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text NOT NULL | |
| `icon` | jsonb | `{ type: 'emoji'\|'external'\|'file', ... }` |
| `domain` | text UNIQUE NULL | For SSO |
| `plan` | text NOT NULL DEFAULT 'free' | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `email` | citext UNIQUE NOT NULL | |
| `name` | text | |
| `avatar_url` | text | |
| `type` | text NOT NULL CHECK in ('person','bot') | |
| `bot_owner_id` | uuid REFERENCES users(id) NULL | for bots |
| `created_at`, `updated_at` | timestamptz | |

### `workspace_members`

| Column | Type | Notes |
|--------|------|-------|
| `workspace_id` | uuid REFERENCES workspaces(id) | |
| `user_id` | uuid REFERENCES users(id) | |
| `role` | text CHECK in ('owner','member','guest') | |
| PK | (workspace_id, user_id) | |

### `pages`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | exposed as `id` in API |
| `workspace_id` | uuid REFERENCES workspaces(id) | |
| `parent_type` | text CHECK in ('workspace','page','database') | |
| `parent_id` | uuid NULL | nullable when parent is workspace |
| `archived` | bool NOT NULL DEFAULT false | soft delete |
| `in_trash` | bool NOT NULL DEFAULT false | |
| `is_template` | bool NOT NULL DEFAULT false | |
| `cover` | jsonb | |
| `icon` | jsonb | |
| `created_by` | uuid REFERENCES users(id) | |
| `last_edited_by` | uuid REFERENCES users(id) | |
| `created_at`, `last_edited_at` | timestamptz | |

Indexes: `(workspace_id, parent_id)`, `(workspace_id, archived, last_edited_at desc)`.

### `databases`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `workspace_id` | uuid | |
| `parent_type`, `parent_id` | as above | |
| `title` | jsonb NOT NULL | rich-text array |
| `description` | jsonb | rich-text array |
| `is_inline` | bool DEFAULT false | |
| `archived` | bool | |
| timestamps + audit columns | | |

### `database_properties`

A database's schema. Each row defines one property of the database.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | exposed; stable for the lifetime of the property |
| `database_id` | uuid REFERENCES databases(id) | |
| `name` | text NOT NULL | display name (renamable) |
| `type` | text NOT NULL | one of the 15 property types — see `docs/api/schemas/property-types.md` |
| `config` | jsonb NOT NULL | type-specific config (select options, formula expr, relation target, rollup spec, etc.) |
| `position` | text NOT NULL | fractional index for column order |
| UNIQUE | (database_id, name) | enforce unique names |

### `database_views`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `database_id` | uuid | |
| `name` | text NOT NULL | |
| `type` | text CHECK in ('table','board','gallery','list','calendar','timeline') | |
| `filter` | jsonb | filter object per `docs/api/schemas/filters.md` |
| `sort` | jsonb | sort array |
| `group_by` | jsonb | for board/calendar/timeline |
| `visible_properties` | jsonb | array of property_ids in display order |
| `position` | text | tab order |

### `pages.properties` (a.k.a. `page_properties`)

Each row stores one property value of one page (when the page belongs to a database).

| Column | Type | Notes |
|--------|------|-------|
| `page_id` | uuid REFERENCES pages(id) | |
| `property_id` | uuid REFERENCES database_properties(id) | |
| `value` | jsonb NOT NULL | type-specific value envelope |
| PK | (page_id, property_id) | |

For non-database pages, only the `title` property exists (stored either here against a virtual property or — preferred — directly on the page's first heading block; we use the dedicated property row keyed by a per-workspace synthetic property_id `'__title__'`).

### `blocks`

The block tree is an **adjacency list** with **fractional indexing** for sibling order.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `workspace_id` | uuid | denormalised for permission checks |
| `parent_type` | text CHECK in ('page','block','database') | |
| `parent_id` | uuid | |
| `position` | text NOT NULL | fractional index — see below |
| `type` | text NOT NULL | one of the ~20 block types |
| `content` | jsonb NOT NULL | type-specific payload (rich text array, child page id, file ref, etc.) |
| `has_children` | bool NOT NULL DEFAULT false | maintained by triggers |
| `archived` | bool NOT NULL DEFAULT false | |
| audit + timestamps | | |

Indexes:
- `(parent_id, position)` for child listing.
- `(workspace_id, type, last_edited_at desc)` for search indexer.
- GIN on `content` for ad-hoc admin queries (not for hot paths).

**Fractional indexing** (`position`):
- We use lexicographic strings (base-62) so that any two siblings always have a string lexicographically between them.
- Reference algorithm: [Figma's fractional indexing](https://www.figma.com/blog/realtime-editing-of-ordered-sequences/). Implementation lives in `packages/db/src/fractional-index.ts`.
- Re-balancing when key length exceeds 50 chars (rare).

### `comments`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `discussion_id` | uuid REFERENCES discussions(id) | |
| `parent_type` | text CHECK in ('page','block') | |
| `parent_id` | uuid | |
| `rich_text` | jsonb NOT NULL | |
| `created_by`, `last_edited_by` | uuid | |
| timestamps | | |

### `discussions`

| Column | Type |
|--------|------|
| `id` | uuid PK |
| `parent_type`, `parent_id` | |
| `resolved` | bool DEFAULT false |
| `anchor` | jsonb | for block-anchored discussions (block_id + selection range) |
| timestamps | |

### `files`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `workspace_id` | uuid | |
| `uploaded_by` | uuid | |
| `name` | text | |
| `size_bytes` | bigint | |
| `mime` | text | |
| `storage_key` | text NOT NULL | S3 key |
| `url_expires_at` | timestamptz | for signed URL refresh |
| `created_at` | timestamptz | |

### `permissions`

Entry-based ACL. Resolved per-request.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `resource_type` | text CHECK in ('page','database') | |
| `resource_id` | uuid | |
| `grantee_type` | text CHECK in ('user','workspace','public','link','teamspace') | |
| `grantee_id` | uuid NULL | null for public/workspace-wide |
| `level` | text CHECK in ('full_access','can_edit','can_edit_content','can_comment','can_read','no_access') | |
| `created_at`, `created_by` | | |

### `audit_events`

Append-only.

| Column | Type |
|--------|------|
| `id` | uuid PK |
| `workspace_id` | uuid |
| `actor_user_id` | uuid |
| `action` | text |
| `resource_type`, `resource_id` | |
| `metadata` | jsonb |
| `created_at` | timestamptz |

## Polymorphic property value envelope

Every `page_properties.value` is a JSON object of the shape:

```jsonc
{
  "type": "<property_type>",
  // exactly one of the type-specific fields below
  "title": [{ /* rich text */ }],
  "rich_text": [{ /* rich text */ }],
  "number": 123.45,
  "select": { "id": "...", "name": "Done", "color": "green" },
  "multi_select": [{ "id": "...", "name": "P0", "color": "red" }],
  "status": { "id": "...", "name": "In progress", "color": "blue" },
  "date": { "start": "2026-05-15", "end": null, "time_zone": null },
  "people": [{ /* user object */ }],
  "files": [{ /* file object */ }],
  "checkbox": true,
  "url": "https://...",
  "email": "...",
  "phone_number": "...",
  "formula": { "type": "string", "string": "computed" },
  "relation": [{ "id": "<page-id>" }],
  "rollup": { /* rollup result */ },
  "created_time": "2026-05-15T19:15:00Z",
  "created_by": { /* user object */ },
  "last_edited_time": "...",
  "last_edited_by": { /* user object */ }
}
```

Exactly the type field that matches `type` is populated. Validators in `packages/shared/properties/*.ts` reject any other shape.

## Block content envelope

Same pattern. Example for paragraph:

```jsonc
{
  "type": "paragraph",
  "paragraph": {
    "rich_text": [ /* RichText[] */ ],
    "color": "default",
    "children": [ /* not stored here — children live in blocks table */ ]
  }
}
```

The `children` array is **never** stored inside `content`; children are separate rows referenced by `parent_id`. The API materialises them only when explicitly requested.

## Constraints, triggers, integrity

- `blocks.has_children` maintained by `AFTER INSERT/DELETE` trigger.
- `pages.last_edited_at` and `last_edited_by` bumped via service layer on any block/property mutation under that page (transaction-scoped).
- `database_properties.position` rebalanced via background job if key length exceeds 50.
- Foreign keys are `ON DELETE RESTRICT` for `users` and `workspaces`; `ON DELETE CASCADE` only within the page subtree (`blocks` cascade from `pages`).

## Indexes (summary)

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| `idx_blocks_parent` | blocks | (parent_id, position) | children listing |
| `idx_blocks_workspace_type` | blocks | (workspace_id, type, last_edited_at desc) | indexer |
| `idx_pages_workspace_parent` | pages | (workspace_id, parent_id) | sidebar / nav |
| `idx_pages_workspace_edit` | pages | (workspace_id, archived, last_edited_at desc) | recently edited |
| `idx_page_properties_property` | page_properties | (property_id, (value->>'type')) | property-scoped lookups |
| `idx_permissions_resource` | permissions | (resource_type, resource_id) | ACL resolution |
| `idx_audit_workspace_created` | audit_events | (workspace_id, created_at desc) | audit log |

## Migrations

- All migrations live in `packages/db/src/migrations/<timestamp>__<slug>.sql`.
- Reversible via paired `_up.sql` / `_down.sql`.
- Forward-only in production with `prod` tag for irreversible (data-loss) migrations.