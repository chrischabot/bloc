# Phase 13 — Pixel-Perfect Validation

## Goal

Verify the product is indistinguishable from notion.so to a careful observer.

## Read first

- `docs/frontend/17-pixel-perfect-checklist.md`

## Deliverables

1. For every checklist item: side-by-side screenshot bundle (`reference/screenshots/PHASE-13/`).
2. Full Playwright tour:
   - Sign in.
   - Sidebar exploration.
   - Create page with all 32 block types.
   - Create database with all 20 property types.
   - Switch through all 6 views.
   - Filter / sort / group on multiple properties.
   - Share with a teammate.
   - Comment + mention.
   - Search.
   - Theme toggle.
   - Settings traversal.
3. Recorded video attached to the release tag.
4. Final benchmark report.
5. Final observability audit:
   - 100% of UI actions and API calls produced traces (sampled count).
   - 100% of failure-case requests in the chaos run emitted structured error logs.

## Todos

- [ ] 13.1 Visual diffs < 1% across the suite
- [ ] 13.2 Pixel-perfect checklist 100% ticked
- [ ] 13.3 Recorded tour video
- [ ] 13.4 Final benchmark report
- [ ] 13.5 Observability audit pass

## Definition of Done

- Universal DoD.
- All cross-cutting items in `docs/PLAN.md#cross-cutting` ticked.
- Release artefacts published.