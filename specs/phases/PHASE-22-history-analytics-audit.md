# Phase 22 — Version History, Page Analytics & Audit Log

## Goal

Ship the content-observability surfaces: page version history with diff + restore, page analytics, and the workspace audit-log UI.

## Read first

- `docs/frontend/34-version-history-analytics-audit.md`
- `docs/architecture/05-realtime-architecture.md#persistence`

## Deliverables

1. `page_versions_index` materialised view + refresher job (every 30 s).
2. Page-history drawer in the editor: cluster list, hover-diff overlay, restore flow.
3. Restore implemented as a Yjs update derived from the snapshot diff so live editors converge cleanly.
4. Retention enforcement worker (cuts off old `block_updates` per plan).
5. Page-views aggregator job + `page_views` + `page_views_daily`.
6. Page analytics endpoints + UI tabs.
7. Audit-log endpoint + UI table + live SSE stream.
8. Audit-log CSV export (signed URL).
9. All necessary new actions added to the audit catalogue, emitted by their respective handlers.

## Todos

- [ ] 22.1 Version history drawer + diff overlay + restore
- [ ] 22.2 `page_versions_index` view + refresher
- [ ] 22.3 Retention enforcement per plan
- [ ] 22.4 Page Analytics aggregator + UI
- [ ] 22.5 Audit log table + live SSE
- [ ] 22.6 Endpoint suite + ACL
- [ ] 22.7 Contract / SDK / chaos / observability / benchmark green
- [ ] 22.8 Visual regression for history drawer + analytics + audit table

## Definition of Done

- Universal DoD.
- Integration: 3-edit / 2-author scenario produces 2 clusters; restoring the first yields the expected page content; live editors in another tab observe the restore as a normal Yjs update.
- Audit log: non-admin gets 403; CSV export streams without timeout for a 1M-row workspace.

## Pitfalls

- Restore must not bypass automations — it should fire `page.updated` like any other write, producing audit events and triggering automations.
- Page-view aggregation can become a hot path; ensure inserts are batched (1s tumbling window per page) and the daily roll-up is single-writer.