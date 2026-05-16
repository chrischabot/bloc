# Phase 15 — Forms & Charts

## Goal

Ship form views with public submission, plus chart views and chart blocks with every documented chart kind.

## Read first

- `docs/frontend/21-forms.md`
- `docs/frontend/22-charts.md`
- `docs/api/endpoints/forms.md`
- `docs/api/schemas/chart-config.md`

## Deliverables

1. View type `form` in the database-view editor (Phase 9 view tabs gain `+ Form`).
2. Public form renderer at `<workspace>.notion.site/forms/<id>`.
3. Cloudflare Turnstile (or stub provider in dev) wired on public submissions.
4. View type `chart` and block type `chart`:
   - Chart engine in `packages/db/src/chart-engine.ts` (filter → SQL → aggregation → series).
   - Renderer in `packages/editor/src/blocks/chart/` and `apps/web/.../database/ChartView.tsx` using `visx`.
   - Configurator UI (right-side drawer).
5. Tests: every chart kind unit + visual; every form field type E2E; chaos on public submission; observability spans on chart compile + form submit.
6. Performance: chart render < 250 ms (1k points); form submit p99 < 350 ms.

## Todos

- [ ] 15.1 Form view editor
- [ ] 15.2 Public form renderer + Turnstile
- [ ] 15.3 Form submission endpoint + anti-abuse
- [ ] 15.4 Submissions list panel
- [ ] 15.5 Chart engine compiler + cache
- [ ] 15.6 Chart renderer per kind
- [ ] 15.7 Chart configurator UI
- [ ] 15.8 Chart block type
- [ ] 15.9 SDK additions
- [ ] 15.10 Contract / SDK / chaos / obs / benchmark green
- [ ] 15.11 Visual regression per chart kind + form page

## Definition of Done

- Universal DoD.
- Public form page reachable and submittable without auth; submission lands a row.
- Every chart kind in `chart-config.md` renders with a golden fixture.
- INP < 100 ms on chart kind switch in the configurator.

## Pitfalls

- Aggregation `percent_*` on jsonb properties requires care with NULL semantics.
- Form upload field must use the existing pre-signed upload flow — do not stream bytes through the form endpoint.