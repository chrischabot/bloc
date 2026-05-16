# Auth Endpoints

## Email magic link

### `POST /v1/auth/email/start`

Body: `{ "email": "alice@example.com" }`. Returns `204` regardless of whether the address exists (no enumeration). Sends an email with a short-lived link.

### `GET /v1/auth/email/callback?token=...`

Validates the token (single-use, 15-minute expiry). On success: sets session cookie and redirects to `/`.

### `POST /v1/auth/logout`

Invalidates the current session. Returns `204`.

## OAuth (we are the IdP)

### `GET /v1/oauth/authorize`

Query: `client_id`, `redirect_uri`, `response_type=code`, `state`, `owner=user`. Renders the consent screen.

### `POST /v1/oauth/token`

Form-urlencoded: `grant_type=authorization_code|refresh_token`, plus the appropriate fields. Returns the token bundle (see `docs/api/04-authentication.md`).

## OAuth (we are the RP) — Google

### `GET /v1/auth/google/start`

Redirects to Google's authorize endpoint with PKCE.

### `GET /v1/auth/google/callback?code=...`

Exchanges, links to a user (creates if new), sets session cookie.

## Integration tokens

### `POST /v1/integrations`

Body: `{ "name": "My Integration", "workspace_id": "uuid", "capabilities": ["read_content","update_content","insert_content","read_user_with_email"] }`. Returns the integration with the raw token (shown once).

### `GET /v1/integrations`

List integrations created by the current user.

### `DELETE /v1/integrations/{id}`

Revoke.

## Test obligations

- Contract: magic-link happy path, token reuse rejected, expired token rejected, oauth code reuse rejected, oauth state mismatch rejected, integration revocation effective immediately (next request 401).
- Chaos: email header injection, redirect_uri allowlist bypass attempts, oversized tokens, PKCE verifier mismatch — all clean 4xx with structured logs.