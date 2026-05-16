# External Data Sync (Workers)

External data sync lets a database mirror rows from an external source (Jira, GitHub, Salesforce, Zendesk, …). The sync runs on the **Worker** runtime — code declared by the integration that executes server-side on a schedule.

## Concepts

- A **sync source** is an external system (e.g. `github:repos/acme/api/issues`).
- A **sync binding** ties a database to a sync source. The binding maps external fields → database properties.
- A **sync run** is one execution of a binding's pull (and optional push) step.

## Endpoints

### `POST /v1/databases/{database_id}/sync_bindings`

Create a binding.

```jsonc
{
  "source": "github",
  "config": { "repo": "acme/api", "type": "issues" },
  "field_map": [
    { "source_field": "title",   "property_id": "<uuid>" },
    { "source_field": "state",   "property_id": "<uuid>" },
    { "source_field": "labels[]","property_id": "<uuid>" }
  ],
  "schedule": "PT15M",
  "two_way": false
}
```

### `GET /v1/databases/{database_id}/sync_bindings`

List bindings on a database.

### `PATCH /v1/sync_bindings/{id}`

Update field map / schedule / two_way.

### `DELETE /v1/sync_bindings/{id}`

Remove binding.

### `POST /v1/sync_bindings/{id}/runs`

Manually trigger a sync run. Returns the new `sync_run` object.

### `GET /v1/sync_bindings/{id}/runs`

List runs.

## Run object

```jsonc
{
  "object": "sync_run",
  "id": "uuid",
  "binding_id": "uuid",
  "status": "running" | "success" | "partial" | "failed",
  "started_at": "...",
  "ended_at": "...|null",
  "rows_pulled": 124,
  "rows_pushed": 0,
  "errors": [ { "external_id":"...","error":"..." } ]
}
```

## Worker runtime

A workspace can register a Worker (TypeScript code) via the developer portal. Workers execute in a sandboxed runtime with:

- Inbound: trigger payload (binding config, last-run cursor).
- Outbound: function returns an array of `{ external_id, fields }` rows; server reconciles against the database.
- Resource limits: 256 MB memory, 60 s wall clock, 10 MB egress per invocation.

## Conflict resolution

- Each row carries an `external_id` (unique within the binding).
- Two-way bindings store a `last_synced_hash`; concurrent edits from Notion and the source resolve via:
  - `notion_wins` (default), `source_wins`, or `last_writer_wins`.

## Tests

- Integration: a stub GitHub Worker pulls 100 issues, asserts rows created with correct property values.
- Chaos: Worker timeout, Worker exception, malformed external row, duplicate `external_id` → all logged, run status `partial`.
- Observability: `sync.run` span with `binding_id`, `rows_pulled`, `rows_pushed`, `errors_count`; metric `sync_runs_total{binding,status}`.