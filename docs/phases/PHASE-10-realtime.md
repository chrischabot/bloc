# Phase 10 — Realtime Collaboration

## Goal

Multiplayer editing with presence + remote cursors + offline replay.

## Read first

- `docs/architecture/05-realtime-architecture.md`

## Deliverables

1. WebSocket gateway in `apps/api/src/ws/` with auth + permission check + Y.Doc binding.
2. Client provider in `packages/editor/src/sync/` connecting to the gateway with bearer/session auth.
3. `block_updates` table + compactor job in `apps/worker`.
4. Awareness: presence avatars, remote cursors, selection highlights.
5. Cross-store sync: REST writes appear live; WS writes project to Postgres.
6. Offline replay (y-indexeddb persistence).
7. Load test: 50 concurrent editors per page; keystroke ack p99 < 80ms.

## Todos

- [ ] 10.1 WS gateway
- [ ] 10.2 Yjs doc per page
- [ ] 10.3 Presence avatars
- [ ] 10.4 Awareness per cell/block
- [ ] 10.5 Conflict resolution preserves intents
- [ ] 10.6 Offline replay
- [ ] 10.7 Load test 50 concurrent

## Definition of Done

- Universal DoD.
- Two-tab Playwright test: edits in one tab appear in the other within 200ms.
- Fuzz test: 10s of concurrent random edits on 5 simulated peers converges to identical document state.
- Load report committed.

## Pitfalls

- Always validate awareness messages — they are user-controlled and can leak presence to unauthorised users.
- The Postgres projection on WS update must be idempotent; tag each operation with `(clientId, clock)` and dedupe.