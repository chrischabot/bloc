# Phase 21 — Webhooks, Notion Mail & Connections

## Goal

Final functional layer: workspace event webhooks for third-party integrations, the Notion Mail client surface, and the connection / integration admin panels.

## Read first

- `docs/api/endpoints/webhooks.md`
- `docs/frontend/32-notion-mail.md`
- `docs/frontend/33-connections-and-integrations.md`

## Deliverables

1. Webhook CRUD endpoints + verification handshake + HMAC signing helper in `packages/shared/src/webhooks.ts`.
2. Delivery worker `apps/worker/src/jobs/deliver-webhook.ts` with exponential backoff, auto-disable on 5 consecutive failures, audit + email on auto-disable.
3. Event emitter taps on every domain mutation that fires the catalogued events.
4. Webhook UI under `Settings → My integrations → {integration} → Webhooks`: create / verify / view deliveries (success rate, last attempt) / ping.
5. Notion Mail core:
   - Provider abstraction (`packages/mail/src/<provider>.ts`) for Gmail / iCloud / Microsoft + a test stub.
   - Sync worker.
   - Three-pane layout per `docs/frontend/32-notion-mail.md`.
   - Composer with editor block parity, schedule-send, AI Compose.
   - Smart inbox classifier (simple rules + LLM fallback) with workspace privacy honoured.
6. Mail rules engine reusing the automation step executor.
7. `Convert to page` and `Create task` flows.
8. My Connections / Workspace Connections / My Integrations panels.
9. Audit + observability on every connect / disconnect / install / revoke.

## Todos

- [ ] 21.1 Webhook CRUD + verification handshake
- [ ] 21.2 HMAC signing + receiver verification helper
- [ ] 21.3 Delivery worker + backoff + auto-disable
- [ ] 21.4 Event emitter taps
- [ ] 21.5 Webhook UI (create / verify / deliveries / ping)
- [ ] 21.6 Mail provider abstraction + Gmail stub
- [ ] 21.7 Mail sync worker
- [ ] 21.8 Mail three-pane layout
- [ ] 21.9 Mail composer with editor block parity
- [ ] 21.10 Mail rules engine
- [ ] 21.11 Convert-to-page / Create-task
- [ ] 21.12 Connections panels (user + workspace + developer)
- [ ] 21.13 Contract / SDK / chaos / observability / benchmark green
- [ ] 21.14 Visual regression for Mail + Connections + Webhook deliveries log

## Definition of Done

- Universal DoD.
- Webhook delivery integration test: signed POST verified by a Vitest server within < 200ms; auto-disable on 5×5xx.
- Mail integration: send a stubbed message → thread state updates → composer round-trip preserves all editor blocks.
- Connection panel: connect / disconnect cycle produces matching audit events.

## Pitfalls

- HMAC: include the raw body, not a parsed form; include the timestamp header and reject deliveries older than 5 min on the receiver side.
- Mail HTML rendering: never inline arbitrary CSS or scripts; sanitise via `dompurify` + scope styles.
- Mail rules cycle: a rule's outgoing step that touches mail state must not re-fire the same rule on the resulting state. Track `triggered_by_rule_id` and reject re-triggering.