# Version History, Page Analytics & Audit Log

Three related observability-of-content surfaces.

---

## Page Version History

Every page has a time-travel view of its prior states. Backed by the `block_updates` log (see `docs/architecture/05-realtime-architecture.md#persistence`).

### Entry point

- Page three-dot menu → **Page history**.
- Or `Cmd+Shift+H`.

### Layout

A right-side drawer (480 px) over a non-interactive snapshot of the page:

```
┌───────────────────────────────────────────┬─────────────────────────┐
│  Snapshot at: Today at 14:32 — Alice      │  Versions               │
│  (read-only render of the editor at that  │  ─ Today                │
│   point in time, no realtime cursors)     │   • 14:32  Alice        │
│                                            │   • 11:08  Bob          │
│                                            │  ─ Yesterday            │
│                                            │   • ...                 │
│                                            │  ─ Last 7 days          │
│                                            │   • ...                 │
│                                            │  ─ Last 30 days         │
│                                            │   • ...                 │
│                                            │                         │
│                                            │  Restore this version   │
│                                            │  ↺                      │
└───────────────────────────────────────────┴─────────────────────────┘
```

### Behaviour

- Versions are clustered by author + idle gap (≥ 5 min); each cluster's last update timestamps the version chip.
- Hover a chip → diff highlights (added blocks in green, deleted in red, modified in yellow) overlay the snapshot.
- **Restore this version** → confirmation modal → applies the diff as a new Yjs update (audit + automation triggers fire normally).
- Retention by plan: 7 days (Free), 30 days (Plus), 90 days (Business), unlimited (Enterprise). After cut-off the worker compacts and discards.

### Data model

Already covered by `block_updates`. We add a derived materialised view `page_versions_index` for fast clustering:

```
page_versions_index (
  page_id uuid,
  cluster_start timestamptz,
  cluster_end timestamptz,
  author_user_id uuid,
  update_count int,
  approximate_diff_size int,
  PK (page_id, cluster_start)
)
```

Refreshed every 30 s by a background job (lightweight; idempotent).

### API

- `GET /v1/pages/:id/versions?from=&to=&start_cursor=&page_size=` — paginated clusters.
- `GET /v1/pages/:id/versions/{cluster_id}/snapshot` — returns the page object rendered at that point.
- `GET /v1/pages/:id/versions/{cluster_id}/diff` — JSON diff against the current page.
- `POST /v1/pages/:id/versions/{cluster_id}/restore` — restore.

### Tests

- Integration: edit a page 3 times by 2 authors → 2 clusters; restore the first; assert content matches.
- Chaos: restore on archived page (422), restore beyond retention (404), restore by user without `can_edit` (403).
- Observability: span `pages.version.restore` carries from/to cluster ids + affected block count.

---

## Page Analytics

Paid-plan surface showing engagement on a page.

### Entry point

- Page three-dot menu → **Updates & analytics**.
- Page top-bar bell icon's secondary tab.

### Metrics

- **Views** total + chart (last 30 days, last 90 days, all time).
- **Unique viewers** in the workspace, with avatars sorted by last view.
- **Edits** count by author.
- **Comments** opened / resolved.
- **Public views** (when published): country bar, referrer list, top devices.
- **Link clicks** (when published with link tracking).

### Privacy

- Workspace-internal analytics rely on the existing audit log; identifiable by member only when the workspace policy allows.
- Public analytics use a privacy-friendly counter (no fingerprinting, no cookies).

### Data model

```
page_views (
  page_id uuid,
  viewer_user_id uuid NULL,
  is_public bool,
  country text NULL,
  referrer_host text NULL,
  device text,
  occurred_at timestamptz,
  INDEX (page_id, occurred_at desc)
)
```

A 1-row-per-pageview aggregator job rolls older rows into a `page_views_daily` materialised view.

### API

- `GET /v1/pages/:id/analytics?period=30d|90d|all` — returns aggregate counts + per-viewer breakdown.

### Tests

- Integration: visiting a page increments view count; viewer avatar appears.
- Chaos: bot UA detected and excluded; oversized referer string truncated.

---

## Workspace Audit Log

Enterprise admin surface showing every audit event.

### Entry point

`Settings → Workspace → Audit log` (admin / owner only).

### Layout

- Top filter bar: actor, action, resource type, date range.
- Table:
  - `Time`, `Actor`, `Action`, `Resource`, `Result`, `IP`, `Details` (expandable).
- Export to CSV button.
- Live updating (new rows stream in via WebSocket).

### Data source

The `audit_events` table from `docs/architecture/03-data-model.md` with the following additional canonical actions:

```
session.created
session.invalidated
integration.created
integration.revoked
oauth.app.installed
oauth.app.uninstalled
permission.granted
permission.revoked
page.created / updated / archived / deleted / restored
database.created / updated / locked / unlocked
workspace.member.added / removed / role_changed
publication.created / updated / deleted
custom_domain.created / verified / removed
automation.created / updated / deleted / run_failed
webhook.created / verified / disabled / deleted
mail.account.connected / disconnected
ai.run.completed / failed
verification.changed
```

### API

- `GET /v1/workspaces/:id/audit_events?from=&to=&actor=&action=&resource_type=&start_cursor=&page_size=` — paginated; admin only.
- `GET /v1/workspaces/:id/audit_events:export.csv` — streamed CSV; expires-in-1h signed URL.

### Tests

- E2E: perform a sample of actions, observe matching audit rows; admin filter narrows results; non-admin gets 403.
- Visual: table layout + filter chips.
- Performance: cursor pagination through 1M rows p99 < 200 ms.