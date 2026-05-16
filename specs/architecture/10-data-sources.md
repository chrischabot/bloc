# Data Sources

The 2025-09-03 API restructure introduced a new primitive between `database` and `page`: a **data source**. A database hosts one or more data sources; views display rows from a data source.

## Why it exists

Before data sources, a Notion database was effectively `(schema, rows, views)` with a 1:1 between schema and view set. Use cases that required:

- two different rows-collections under one logical "database" (e.g. tasks + archived tasks),
- views that aggregate rows from elsewhere (linked databases on steroids),
- federation across workspace boundaries (an upcoming surface),

…all forced ugly workarounds. The data source primitive separates "the schema + rows" from "the database object that hosts them".

## Object model

```
database
 ├── data_source A   (the canonical content)
 ├── data_source B   (e.g. archive of A)
 └── linked source → data_source C of database X (read-only mirror)
collection_view (database_view)
 └── data_source_id (which data source the view renders)
page
 └── parent.data_source_id (replaces the prior parent.database_id where set)
```

## Tables (additions to `docs/architecture/03-data-model.md`)

```
data_sources (
  id uuid PK,
  database_id uuid REFERENCES databases(id),
  name text NOT NULL,
  type text CHECK in ('owned','linked'),
  source_database_id uuid REFERENCES databases(id) NULL,  -- for 'linked': the upstream
  source_data_source_id uuid REFERENCES data_sources(id) NULL, -- the specific upstream source
  archived bool DEFAULT false,
  position text NOT NULL,    -- ordering within database
  created_at, updated_at timestamptz
)
```

Existing tables gain a `data_source_id` column (nullable for back-compat):

- `pages.data_source_id` — the row's data source (when parent is database).
- `database_views.data_source_id` — which data source the view renders.
- `database_properties.data_source_id` — properties belong to a data source (not the database directly), because a database with multiple owned sources may have different schemas per source.

A migration backfills: every existing database creates a default `data_source` whose id is identity-mapped from the database for stable cursors, with all existing pages, views, and properties pointed at it.

## API impact

### Notion-Version `2026-04-01` (current baseline)

The data-source object becomes the addressable resource for read/write. Pages and views still surface a `parent` and the database object exists, but operations route through data sources.

### New endpoints

| Endpoint | Behaviour |
|----------|-----------|
| `POST /v1/databases/{id}/data_sources` | Create a new data source under a database |
| `GET /v1/databases/{id}/data_sources` | List the database's data sources |
| `GET /v1/data_sources/{id}` | Retrieve a data source (schema + meta) |
| `PATCH /v1/data_sources/{id}` | Rename, archive, change schema |
| `DELETE /v1/data_sources/{id}` | Archive |
| `POST /v1/data_sources/{id}/query` | Query rows (replaces `POST /v1/databases/{id}/query` for new-version callers) |

### Updated endpoints

- `POST /v1/pages` body — when parent is a database, callers should set `parent.data_source_id` (preferred over `parent.database_id`). When `parent.database_id` is set, the server resolves to the database's **default** data source.
- `POST /v1/databases/{id}/query` remains available for legacy callers; routes to the database's default data source.

### Versioning

The dual-routing (`database_id` legacy / `data_source_id` modern) is gated by `Notion-Version`:

- Versions `< 2025-09-03`: `database_id` is the only addressable handle; data sources are invisible.
- Versions `≥ 2025-09-03`: both `database_id` and `data_source_id` are accepted; the response shape includes `data_source_id` fields.

`packages/shared/src/version.ts` ranks the version strings and the API layer translates payloads accordingly.

## Linked data sources

A linked data source mirrors rows from an upstream source. Behavior:

- Schema is read-only; views may add filters / sorts / column visibility but cannot add / remove / rename properties.
- New rows inserted via the linked source materialise on the upstream and propagate back.
- Permissions: the viewer must have at least `can_read` on the upstream resource; updates require `can_edit` upstream.

## Frontend impact

The database surface (`docs/frontend/07-database-views.md`) gains a **data source selector** at the top of the view tabs row when a database has more than one source. When only one source exists, it is hidden (preserving the original UX).

- Switching the selector swaps the underlying data source for the current view (or, on confirmation, creates a new view bound to the chosen source).
- "Linked data source" sources show a small "linked" badge with the originating database name.

## SDK impact

The SDK gains a `client.dataSources` namespace mirroring `client.databases`:

```ts
client.dataSources.create({ database_id, ... });
client.dataSources.retrieve({ data_source_id });
client.dataSources.update({ data_source_id, ... });
client.dataSources.query({ data_source_id, filter, sorts, ... });
```

Old `client.databases.query` continues to work and routes to the default source under the hood.

## Tests

- Migration: existing fixtures back-fill to a default data source; round-trips are identical.
- Contract: every `data_source` endpoint matches the documented shape.
- SDK-progressive: `client.dataSources.*` byte-matches the official SDK output (using the official client pointed at our server).
- Chaos: linked-source cycles (A → B → A), cross-workspace links without permission, queries with mixed `database_id` + `data_source_id` parameters.
- Observability: `data_source.id` is added to every span that previously had only `database.id`.