# Authentication & Authorization

## Modes

| Mode | Used by | How |
|------|---------|-----|
| Session cookie | The web app | `lucia-auth` session, http-only, sameSite=lax, secure |
| Bearer integration token | API users, SDK | `Authorization: Bearer secret_xxx` |
| OAuth 2.0 (we are the IdP) | 3rd-party apps wanting to read user data | Authorization code + PKCE |
| OAuth login (we are the RP) | Users signing in via Google | OIDC |

## Session flow

1. `POST /v1/auth/email/start` — issues magic link to email
2. `GET /v1/auth/email/callback?token=...` — exchanges token for a session cookie
3. `POST /v1/auth/logout` — revokes session

Sessions live 30 days, sliding expiry on use. Stored in Postgres `sessions` table:

| Column | Type |
|--------|------|
| `id` | text PK (random 32-byte b64url) |
| `user_id` | uuid |
| `expires_at` | timestamptz |
| `user_agent` | text |
| `ip` | inet |
| `created_at` | timestamptz |

## Integration tokens

Equivalent of Notion's internal integration tokens.

- Created via `POST /v1/integrations` (UI: Settings → Connections → My integrations).
- Token format: `secret_` + 43 random URL-safe chars.
- Stored as bcrypt hash; raw value shown once at creation only.
- Scopes: per integration the user picks which workspaces and which capabilities (read content, update content, insert content, read comments, insert comments, read user info with email, read user info without email).
- `Authorization: Bearer secret_...` header validated per request.

## OAuth (we are the IdP)

For 3rd-party apps wanting workspace access:

1. Developer registers app: gets `client_id`, `client_secret`.
2. User flow: `GET /v1/oauth/authorize?client_id=...&redirect_uri=...&state=...&owner=user` → user picks workspace + capabilities → redirect with `?code=...`.
3. Exchange: `POST /v1/oauth/token` with `code` → returns `{access_token, bot_id, workspace_id, workspace_name, workspace_icon, owner: {...}}`.
4. Tokens are long-lived (no refresh in v1, matches Notion's model).

## Authorization model

- Workspace membership has these roles (highest to lowest privilege):
  - `owner` — full control, including billing, plan, member management, workspace deletion.
  - `membership_admin` — **Enterprise only**; can manage members and groups without billing access. Surfaces as a separately-granted permission on the workspace settings.
  - `member` — standard editor / contributor; counts toward the paid seat count.
  - `restricted_member` — read-only across the workspace; can be granted explicit edit on specific pages. Counts toward seat count but at the restricted tier.
  - `guest` — external collaborator; no workspace-wide access, only the explicitly shared pages. Does **not** count toward the paid seat count.
- Page-level permissions table (`permissions`):
  - levels: `full_access`, `can_edit`, `can_edit_content`, `can_comment`, `can_read`, `no_access`.
  - `can_edit_content` is database-only: the grantee can create / edit / delete rows but cannot change the database schema (properties, views, filters, sorts, automations). On non-database resources it falls back to `can_read`.
  - grantees: `user`, `workspace`, `public`, `link` (link with optional expiry), `group` (workspace-defined group of users), `teamspace`.
- Resolution algorithm (`packages/db/src/permissions.ts`):
  1. Walk up the parent chain to the root page.
  2. For each ancestor, collect ACL entries matching the user (direct, via group, via teamspace, via workspace-wide grant).
  3. The highest level wins per resource; an explicit `no_access` overrides inherited grants.
  4. Workspace owners always have `full_access`. Membership admins have `can_edit` workspace-wide unless explicitly demoted.
  5. Restricted members default to `can_read` workspace-wide; per-resource grants can lift them to `can_edit` / `can_edit_content`.

## Allowed email domains

Workspace owners can specify an allowed-domains list. Effects:

- New invites must match an allowed domain (the invite endpoint rejects with `422 unprocessable_entity` and `code: domain_not_allowed`).
- Existing members whose email later becomes disallowed are surfaced in the admin Members panel for review (never auto-removed).
- A "verify domain" flow (DNS TXT record) unlocks **auto-join**: any user signing up with a verified-domain email is automatically added as `member` (with a workspace toggle to require admin approval).

## SCIM provisioning

Enterprise-only. Endpoints under `/scim/v2/` implement the standard SCIM 2.0 schema for Users and Groups. Out of scope for v1 implementation; the surface is reserved and the workspace setting is shown as "Coming soon" until the phase ships.

## Rate limiting

Implemented in `apps/api/src/middleware/rate-limit.ts` using Redis token bucket.

| Identity | Sustained | Burst |
|----------|-----------|-------|
| Integration token | 3 req/s | 30 |
| Session | 30 req/s | 300 |
| Anonymous | 1 req/s | 5 |

On exceed: HTTP 429 with `Retry-After` and `X-RateLimit-*` headers. Standard rate-limit response headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) are returned on **every** response from baseline `2026-04-01`, not only on 429s — see `docs/api/00-api-overview.md#standard-response-headers` and `docs/api/05-versioning.md`.

## Audit

Every authentication event (`session.created`, `session.invalidated`, `integration.created`, `integration.revoked`, `oauth.code.exchanged`, `permission.granted`, `permission.revoked`) writes to `audit_events`.

## Threat model summary

| Threat | Mitigation |
|--------|------------|
| Token theft | http-only cookies; short-lived magic links; rotate on suspicious IP change |
| CSRF | sameSite=lax + double-submit cookie for state-changing endpoints |
| Brute force | Rate limit + lockout after 5 failed magic-link starts in 10m |
| IDOR | Every resource lookup runs through `requirePermission(user, resource, level)` |
| Mass assignment | All write endpoints use Zod strict schemas; unknown fields rejected |
| Stored XSS in rich text | Allowlist HTML on serialise; never render raw HTML strings from user content |
| Prompt injection in mentions | Mention rendering uses structured nodes, never inline string interpolation |