# Phase 20 — Extended Pixel-Perfect Validation

## Goal

Re-run the pixel-perfect bar over the full surface, including everything added after Phase 13.

## Read first

- `docs/frontend/17-pixel-perfect-checklist.md` (every section including the AI / Sites / Buttons / Forms / Charts / Sub-items / Home / Database-page-layout / Backlinks / Wiki blocks)
- `docs/prompts/PIXEL-PERFECT-REVIEW.md`

## Deliverables

1. Side-by-side screenshot bundle for every item in the extended checklist.
2. Playwright extended tour adding: Writer → AI Block → Q&A → Agent task; publish a page; create a form and submit; create every chart kind; create sub-items + a dependency; turn a page into a wiki + verify; add Home widgets; mention a person + add a reminder.
3. Recorded tour video attached to the release tag.
4. Final benchmark report covering the new endpoints.
5. Observability audit covering AI / Sites / Sync / Forms / Charts / Automations / Wikis spans + metrics.

## Todos

- [ ] 20.1 Extended visual diffs < 1%
- [ ] 20.2 Extended checklist 100% ticked
- [ ] 20.3 Extended tour video
- [ ] 20.4 Final benchmark report including new endpoints
- [ ] 20.5 Observability audit covering all new surfaces

## Definition of Done

- Universal DoD.
- Every cross-cutting item in `docs/PLAN.md#cross-cutting` reaffirmed.
- Release notes updated with the extended scope and links to all artefacts.