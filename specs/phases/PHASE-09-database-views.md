# Phase 9 — Database Views

## Goal

All six database views, view tabs, filters/sorts/groups, property visibility.

## Read first

- `docs/frontend/07-database-views.md`
- `docs/frontend/08-database-properties-ui.md`

## Deliverables

1. View infrastructure in `apps/web/app/(workspace)/[pageId]/database/`:
   - View tabs with add / rename / duplicate / delete / lock.
   - Toolbar (filter / sort / group / properties / search / new).
   - View settings menus.
2. View renderers:
   - TableView, BoardView, GalleryView, ListView, CalendarView, TimelineView.
3. Filter UI builder mapping to `docs/api/schemas/filters.md`.
4. Sort UI mapping to `docs/api/schemas/sorts.md`.
5. Group-by UI for board / calendar / timeline.
6. Properties panel.
7. Inline-edit cells with optimistic updates and rollback on server error.
8. Tests: per-view Playwright, visual snapshots, perf on 1000 rows.

## Todos

- [ ] 9.1 Table view
- [ ] 9.2 Board view
- [ ] 9.3 Gallery view
- [ ] 9.4 List view
- [ ] 9.5 Calendar view
- [ ] 9.6 Timeline view
- [ ] 9.7 View tabs / settings
- [ ] 9.8 Property visibility/order per view
- [ ] 9.9 Filter/sort UI
- [ ] 9.10 Group-by/sub-group
- [ ] 9.11 Optimistic edits + rollback
- [ ] 9.12 E2E + visual

## Definition of Done

- Universal DoD.
- Pixel-perfect checklist for all 6 views ticked.
- Database query against 10k rows with 3-clause AND filter renders first paint < 500ms.