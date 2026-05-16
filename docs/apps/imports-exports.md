# Imports & exports

## Imports

**Settings → Imports**:

| Source | What |
|---|---|
| **Notion** | Drop in a `.zip` exported from Notion. Bloc unpacks and creates pages mirroring the directory structure |
| **Markdown** | A single `.md` file or a `.zip` of files. Front-matter → page properties |
| **CSV** | Maps columns to database properties; creates a new database or appends to an existing one |
| **HTML** | Best-effort conversion |
| **DOCX** | Best-effort conversion via Pandoc-compatible pipeline |

Imports run on the worker. Status visible in the import panel; results land in a target page you specify (default: workspace root).

Programmatic: `POST /v1/imports` with `{ format: 'notion-zip' | 'markdown' | 'csv' | ..., target_page_id, options }`. The upload uses the same pre-signed flow as files. Status via `GET /v1/imports/{id}`.

## Exports

### Per-page

UI: page menu → **Export**. Choose `Markdown`, `PDF`, or `HTML`. `Include sub-pages` controls recursion.

API: `POST /v1/pages/{page_id}/exports` (returns an export id; poll `GET /v1/exports/{id}` for the URL).

### Per-database

UI: database menu → **Export**. Choose `CSV`, `JSON`, or `Markdown`.

API: `POST /v1/databases/{database_id}/exports`.

### Per-workspace

UI: **Settings → Data** → **Export workspace**. Generates a `.zip` of every page + all attachments; can take minutes.

API: `POST /v1/workspaces/me/exports`. Admin only.

## Lifecycle

Export artefacts land in S3 under `exports/{workspace_id}/{export_id}`. Bloc serves them via signed URLs with a 24 h TTL. The S3 bucket should have a 30-day lifecycle rule on the `exports/*` prefix.

## Limits

- Max workspace export: 10 GB. Beyond that, split by teamspace.
- Max per-page PDF: 100 MB rendered.
- Max CSV columns: 200.
- Max import file size: 2 GB.
