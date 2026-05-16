# Phase 17 — Home, Backlinks & Reminders

## Goal

Workspace Home with widgets, first-class backlinks, and reminder mentions.

## Read first

- `docs/frontend/24-home-dashboard.md`
- `docs/frontend/26-backlinks-reminders.md`
- `docs/frontend/25-database-page-layouts.md`

## Deliverables

1. `/home` route with widget grid, drag-reorder, per-widget configuration.
2. Widget data endpoints (`GET /v1/home`) and layout persistence.
3. Backlinks indexer in `apps/worker/src/jobs/index-backlinks.ts`:
   - Subscribes to block / page / relation events.
   - Maintains the `backlinks` table.
4. `GET /v1/pages/:id/backlinks` endpoint with ACL filtering.
5. Backlinks rendering integration in the page header / database-page layout (modes: expanded, popover, off).
6. Reminder data model + worker (`fire-reminder.ts`) running every minute.
7. Reminder inline pill renderer + creation UI in mention popover.
8. Database page-layout customisation panel (Phase 9 extended to support the modes documented in `docs/frontend/25-database-page-layouts.md`).
9. Tests: indexer convergence ≤ 2s; reminder firing within ≤ 90s of fire_at; widget layout persistence E2E.

## Todos

- [ ] 17.1 Home route + widget grid
- [ ] 17.2 Widget endpoints + persistence
- [ ] 17.3 Backlinks indexer
- [ ] 17.4 Backlinks endpoint + ACL filter
- [ ] 17.5 Backlinks UI modes
- [ ] 17.6 Reminder data + worker
- [ ] 17.7 Reminder UI
- [ ] 17.8 Customize-layout drawer (page section + properties section + sub-items + lock)
- [ ] 17.9 Contract / SDK / chaos / obs / benchmark green

## Definition of Done

- Universal DoD.
- Backlinks indexer asserted to converge within 2s in integration test.
- Reminder fires in ≤ 90s on a frozen-clock test with a 1-minute future timestamp.
- Home p99 load ≤ 600 ms with 10 widgets / 100 rows.