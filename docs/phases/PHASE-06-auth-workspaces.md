# Phase 6 — Auth, Workspaces, Permissions

## Goal

Real auth, workspace isolation, permission enforcement, rate limiting.

## Read first

- `docs/architecture/06-authentication.md`
- `docs/api/endpoints/auth.md`
- `docs/api/04-authentication.md`
- `docs/api/03-rate-limiting.md`
- `docs/architecture/08-security.md`

## Deliverables

1. Auth routes in `apps/api/src/routes/auth.ts`: email magic link, Google OAuth, integration tokens, logout, OAuth IdP flow.
2. Session middleware in `apps/api/src/middleware/auth.ts`.
3. Workspace membership endpoints (`POST/DELETE /v1/workspaces/:id/members`) — admin-only.
4. Per-page permissions endpoints (`GET/PUT/DELETE /v1/pages/:id/permissions`).
5. Public page links (`POST /v1/pages/:id/public_url`).
6. Rate-limit middleware backed by Redis Lua token-bucket.
7. Audit logging on every auth + permission event.
8. Contract / SDK / chaos / obs / benchmark green.

## Todos

- [ ] 6.1 Email magic link
- [ ] 6.2 Google OAuth (login)
- [ ] 6.3 Integration tokens
- [ ] 6.4 Workspace membership / roles
- [ ] 6.5 Page-level permissions
- [ ] 6.6 Sharing dialog backend
- [ ] 6.7 Public page links
- [ ] 6.8 Rate limiting

## Definition of Done

- Universal DoD.
- Every endpoint in Phases 2–5 now enforces auth and permissions; integration tests prove unauthorised access returns 404 (no existence leak) or 401 / 403 as appropriate.
- A removed member loses access within 30s (cache TTL).
- A revoked integration token returns 401 on next request.

## Pitfalls

- Magic-link email enumeration: always return 204 from `auth/email/start`.
- Permission cache invalidation: avoid global `DEL perm:*`. Use per-`(user, resource)` keys plus a per-user version counter; mutations bump the version and reads suffix it.