# Authentication

## Bearer tokens

Every authenticated request carries:

```
Authorization: Bearer <token>
```

The token is opaque. Don't try to parse it. Three sources:

1. **Internal integration** — created in workspace settings, lives until revoked.
2. **OAuth access token** — returned by the OAuth token endpoint.
3. **Dev bootstrap** — printed by `apps/web` in dev mode; valid 24 h.

## OAuth 2.0

Three-legged authorization-code flow.

### Authorize

`GET /v1/auth/oauth/authorize`

Query parameters:

| Param | Required | Notes |
|---|---|---|
| `client_id` | yes | Your OAuth client id |
| `redirect_uri` | yes | Must exactly match a URI registered on the client |
| `state` | yes | CSRF token; opaque to Bloc |
| `scope` | no | Space-separated. Defaults to `read write` |
| `response_type` | no | Must be `code`. Defaults to `code` |
| `owner` | no | `user` (default) or `workspace` |

User approves; browser is redirected to `redirect_uri?code=<authorization_code>&state=<state>`.

### Token exchange

`POST /v1/auth/oauth/token`

```json
{
  "grant_type": "authorization_code",
  "code": "<authorization_code>",
  "redirect_uri": "<same as authorize step>",
  "client_id": "...",
  "client_secret": "..."
}
```

Response:

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer",
  "bot_id": "...",
  "workspace_id": "...",
  "workspace_name": "...",
  "workspace_icon": "...",
  "owner": { "type": "user" | "workspace", ... }
}
```

The `Notion-Version` header is required on this call.

### Refresh

`POST /v1/auth/oauth/token`

```json
{
  "grant_type": "refresh_token",
  "refresh_token": "...",
  "client_id": "...",
  "client_secret": "..."
}
```

Access tokens live 30 days; refresh tokens, 90 days. Refresh proactively at 90% of access-token lifetime.

### Revoke

`POST /v1/auth/oauth/revoke`

```json
{ "token": "<access_or_refresh>", "client_id": "...", "client_secret": "..." }
```

Returns `200 {}`.

## Scopes

| Scope | Allows |
|---|---|
| `read` | All `GET` paths the bearer can reach via ACL |
| `write` | Mutating ops on pages, blocks, databases, properties |
| `manage_users` | `/v1/users/*` admin paths |
| `manage_webhooks` | Full CRUD on `/v1/webhooks` |
| `ai` | All `/v1/ai/*` |

Tokens default to `read write` if scopes aren't passed. Internal integrations are issued with whichever scopes are checked at creation time in the workspace settings UI.

## Email / password (dev only)

Used by the web app's login form when no OAuth is configured.

### Request a sign-in code

`POST /v1/auth/code/request`

```json
{ "email": "user@example.com" }
```

Bloc sends a 6-digit code via SMTP. Returns `200 {}`.

### Verify a code

`POST /v1/auth/code/verify`

```json
{ "email": "user@example.com", "code": "123456" }
```

Returns:

```json
{
  "access_token": "...",
  "user": { "object": "user", "id": "...", ... }
}
```

## Bootstrap (dev only)

`POST /v1/bootstrap` — no auth required. Returns a freshly minted dev bearer token and creates an admin user/workspace if none exists. Disabled in production.

## Identifying yourself

`GET /v1/users/me` returns the user or bot the bearer represents.
