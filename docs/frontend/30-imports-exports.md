# Imports & Exports

Notion lets users move content in and out. Both flows live under `Settings → Import / Export` and as inline triggers (paste a public Notion URL, drop a Markdown file, drop a CSV onto an empty database).

## Imports

### Supported sources

| Source | Mechanism |
|--------|-----------|
| **Notion** (public page URL or workspace export ZIP) | Paste public URL, or upload a Notion-exported ZIP |
| **Markdown / Markdown + CSV** | Drop a `.md` or `.zip` with `.md` files + their attachments |
| **HTML** | Upload `.html` or zipped folder; converts via DOM walker |
| **CSV** | Drop on an empty database to create columns from headers |
| **Evernote** | OAuth + ENEX export (deferred — placeholder UI) |
| **Word / Google Docs** | DOCX upload converted via mammoth.js |
| **Confluence** | Cloud OAuth → space picker → page import (deferred) |
| **Trello** | OAuth → board picker → as database with `Lists` as status (deferred) |
| **Asana / Linear / Jira** | OAuth → project picker (deferred to phase 19 sync) |

### Pipeline

1. Worker job `apps/worker/src/jobs/import.ts` consumes the upload (S3 staged).
2. Format-specific parser → intermediate normalized AST (a list of `(path, block_tree)` tuples).
3. Insertion: each path becomes a page under the chosen parent; relations rehydrated by URL→id rewrites in a second pass.
4. Progress reported via SSE on `GET /v1/imports/:id/events`.

### Import UI

- Settings → Import: drag-and-drop zone + tile per source.
- During import: progress bar with per-file status; "Open new pages" CTA on success.
- Failed files: surfaced as a list with the reason; "Retry" button for transient errors.

### Limits

- Single upload ≤ 1 GB (Free), ≤ 5 GB (Plus), ≤ 50 GB (Business+).
- Per-import file count ≤ 50 000 files.

## Exports

### Formats

| Format | Output |
|--------|--------|
| **Markdown & CSV** (per-page + per-database) | `.zip` containing one `.md` per page + a `.csv` per database |
| **HTML** | self-contained zipped folder, with assets, navigable cross-links |
| **PDF** | per-page or per-tree; A4 / Letter, light / dark theme |
| **JSON** | full workspace dump (Business+ — for backups / migration) |

### Export UI

- Page three-dot menu → **Export** → format → options (include sub-pages? include comments? include database content?).
- Workspace settings → Export workspace.

### Pipeline

1. Worker queues `export` job (`apps/worker/src/jobs/export.ts`).
2. Walk the subtree, serialise, write a zip to S3.
3. Email the user a signed-URL download link (24h expiry).

### Constraints

- PDF rendering uses headless Chromium for pixel fidelity; cap 1000 pages per single PDF export job.
- Markdown export round-trips: importing the export back into Notion should reproduce the original tree (asserted in tests).

## API

- `POST /v1/imports` — multipart upload start; returns `{ import_id, upload_url }`.
- `GET /v1/imports/:id` — status.
- `GET /v1/imports/:id/events` — SSE progress.
- `POST /v1/exports` — body `{ root: page_id|workspace_id, format, options }`; returns `{ export_id }`.
- `GET /v1/exports/:id` — status + signed download URL when ready.

## Tests

- Round-trip: export → import → diff against original; structural equality (modulo IDs and timestamps).
- Chaos: 1 GB upload, malformed zip, path traversal in filenames (`..`), CSV with 1M rows (streamed), HTML with cyclic links.
- Observability: import / export spans with file count, byte count, duration, errors.
- Performance: 1k-page workspace Markdown export p99 < 60 s.