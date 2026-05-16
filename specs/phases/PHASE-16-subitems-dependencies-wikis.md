# Phase 16 — Sub-items, Dependencies, Wikis & Verification

## Goal

Hierarchical rows + timeline dependencies in databases; wiki configuration with verification.

## Read first

- `docs/frontend/23-sub-items-dependencies.md`
- `docs/frontend/27-wikis-verification.md`

## Deliverables

1. `databases.config.sub_items` and `databases.config.dependencies` honoured by every relevant view.
2. Cycle prevention helpers `packages/db/src/relations.ts` reused for both.
3. Timeline view renders dependency arrows + drag-to-create dependency.
4. Auto-shift dates on predecessor move (configurable).
5. Wiki page flag, owner property, verification property type, verification flow:
   - `POST /v1/pages/:id/wiki` / `DELETE`
   - `POST /v1/pages/:id/verify` / `POST /v1/pages/:id/unverify`
6. Verification-expiry worker job that flips chips at the configured expiry and emits notifications.
7. UI: verification chip + wiki index block.

## Todos

- [ ] 16.1 Sub-items config + self-relation wiring
- [ ] 16.2 Sub-item UI per view
- [ ] 16.3 Dependencies config + arrow renderer
- [ ] 16.4 Auto-shift dates
- [ ] 16.5 Wiki turn-on/off
- [ ] 16.6 Owner + verification property types
- [ ] 16.7 Verify / unverify endpoints
- [ ] 16.8 Verification-expiry worker
- [ ] 16.9 Wiki index block
- [ ] 16.10 Contract / SDK / chaos / obs / benchmark green

## Definition of Done

- Universal DoD.
- Drag-create / drag-shift / cycle-prevention work in Playwright.
- Frozen-clock expiry test flips chip and triggers notification within one tick.

## Pitfalls

- Auto-shift propagation must be bounded (depth limit + per-page run cap) to prevent cascade storms.
- The verification "expires_at = null (Never)" path must not be processed by the expiry worker.