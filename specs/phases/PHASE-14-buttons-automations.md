# Phase 14 — Buttons & Automations

## Goal

Ship the action engine, the button block, and database automations with full step coverage.

## Read first

- `docs/frontend/20-buttons-automations.md`
- `docs/api/endpoints/automations.md`
- `docs/api/schemas/automation-actions.md`

## Deliverables

1. Block type `button` per `docs/api/schemas/block-types.md` rendered with the editor UI from the frontend doc.
2. Database automations CRUD in `apps/api/src/routes/automations.ts` and a per-trigger worker job in `apps/worker/src/jobs/run-automation.ts`.
3. Step executors in `packages/db/src/automations/steps/<step>.ts` for every step type in `automation-actions.md`.
4. Templating engine `packages/shared/src/automations/template.ts` with strict `{{path}}` resolution and prototype-pollution guards.
5. SDK additions: `client.automations.list/create/update/delete/test`, `client.buttons.invoke`.
6. UI: Step editor; automations list; per-run log viewer.
7. Trigger plumbing:
   - `page_added`, `page_property_changed`, `page_property_meets` from Redis pub/sub.
   - `time` from a BullMQ cron schedule.
8. Idempotency on `(automation_id, page_id, trigger_event_id)`.
9. Rate-limit enforcement per plan.
10. Tests: contract / SDK / chaos (template injection, recursion bombs, infinite-loop detection) / observability / benchmark.

## Todos

- [ ] 14.1 Action engine: step interface + executor wiring
- [ ] 14.2 Template renderer with safe path resolution
- [ ] 14.3 Every step executor implemented
- [ ] 14.4 Button block rendering + invoke endpoint
- [ ] 14.5 Database automations CRUD
- [ ] 14.6 Triggers: page_added, page_property_changed, page_property_meets, time
- [ ] 14.7 Idempotency + rate limits
- [ ] 14.8 Step editor UI (drag-reorder, typed forms)
- [ ] 14.9 Automations list + run log UI
- [ ] 14.10 SDK functions
- [ ] 14.11 Contract / SDK / chaos / obs / benchmark green
- [ ] 14.12 Visual regression for button + step editor

## Definition of Done

- Universal DoD.
- Every step type has a passing chaos test.
- An automation cycle (`X changes → triggers Y → which changes X again`) is detected by the recursion guard and aborted; assertion in chaos.
- Per-run log surfaces in the UI, with per-step latency.

## Pitfalls

- Templating: a naive `lodash.template` style allows JS execution — write a custom path resolver that only accepts `{{a.b.c}}` and rejects any expression characters.
- Trigger storm: a single bulk update should produce at most one automation run per row, not one per property. Coalesce in the worker.