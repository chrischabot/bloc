# Phase 11 — Sharing, Comments, Notifications

## Goal

All collaboration features: share dialog, comments, mentions, inbox, email digests.

## Read first

- `docs/frontend/11-page-header.md#share`
- `docs/frontend/12-comments-ui.md`
- `docs/architecture/06-authentication.md`

## Deliverables

1. Share dialog: invite, role management, anyone-at-workspace, publish to web, public URL.
2. Comments: inline + thread + composer + reactions + resolve.
3. Mentions notify recipients (DB row in `notifications`, fanout via Redis pub/sub to inbox channel).
4. Inbox UI (Updates panel / `/inbox` page).
5. Email digest job (daily summary of unread mentions) — using Mailpit in dev.
6. Tests: end-to-end share flow; comment thread flow; mention triggers inbox + email.

## Todos

- [ ] 11.1 Share dialog UI
- [ ] 11.2 Page comments (inline + thread)
- [ ] 11.3 Replies / resolve / reactions
- [ ] 11.4 Mentions notify
- [ ] 11.5 Inbox tabs
- [ ] 11.6 Email digest worker
- [ ] 11.7 E2E + visual

## Definition of Done

- Universal DoD.
- Mention flow: user A mentions user B → user B's inbox shows the notification within 2s (real-time) and an email is queued.
- Pixel-perfect checklist items for share + comments + inbox ticked.