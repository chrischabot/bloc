# Phase 23 — Final Pixel-Perfect Validation

## Goal

The terminal acceptance gate. After every other phase has closed (0–22), re-run pixel-perfect, performance, and observability validation across the **entire** product surface.

## Read first

- `docs/frontend/17-pixel-perfect-checklist.md` (every section, including all additions from Phases 14–22).
- `docs/prompts/PIXEL-PERFECT-REVIEW.md`.

## Deliverables

1. Side-by-side screenshot bundle for every checklist item, including:
   - Core editor + database surfaces (Phases 7–11).
   - AI surfaces (Phase 18).
   - Sites / public renderer (Phase 19).
   - Buttons / step editor / automations log (Phase 14).
   - Forms (public render) + Chart kinds (Phase 15).
   - Sub-items / dependencies (Phase 16).
   - Wikis / verification chips (Phase 16).
   - Home / Backlinks / Reminders (Phase 17).
   - Database page layout customizer (Phase 17).
   - Notion Mail / Connections (Phase 21).
   - Version history / Analytics / Audit log (Phase 22).
2. Recorded tour video performing every flow end-to-end.
3. Final benchmark report covering every endpoint and every primary UI interaction.
4. Final observability audit:
   - Every UI action produces a trace, with the expected attributes.
   - Every API call produces a trace + log + metric increment.
   - Every webhook delivers with the documented backoff and signing.
   - Every chaos input still returns a clean 4xx with structured logs.

## Todos

- [ ] 23.1 Visual diffs < 1% across the full surface
- [ ] 23.2 Pixel-perfect checklist 100% ticked
- [ ] 23.3 Final tour video covering every feature surface
- [ ] 23.4 Final benchmark report under budget
- [ ] 23.5 Final observability audit
- [ ] 23.6 Release artefacts published

## Definition of Done

- Universal DoD.
- All cross-cutting items in `docs/PLAN.md#cross-cutting` reaffirmed.
- Sign-off documented in `docs/CHANGELOG.md`.