# API Authentication

See `docs/architecture/06-authentication.md` for system-level concepts. This document defines the over-the-wire contract.

## Bearer integration tokens

```
Authorization: Bearer secret_EXAMPLE_TOKEN_replace_with_real_value
```

- Token format: prefix `secret_` followed by 43 chars `[A-Za-z0-9_-]` (32 bytes URL-safe base64).
- Stored as bcrypt hash; comparison uses constant-time bcrypt verify.
- Lookup: token prefix maps to candidate hash via an indexed `integrations` table; bcrypt verify per request is acceptable at our scale (≤ 100k integrations); for higher scale we hash the token with a fast HMAC for lookup and bcrypt for verification.

## Session cookies

```
Cookie: session=<opaque-32-byte-base64url>
```

- http-only; `SameSite=Lax`; `Secure` in production.
- Used by the web app; bearer is preferred for integrations.

## OAuth (we are IdP)

`POST /v1/oauth/token`

Body (form-urlencoded):
```
grant_type=authorization_code
code=...
redirect_uri=...
client_id=...
client_secret=...
```

Response (200):
```json
{
  "access_token": "secret_...",
  "token_type": "bearer",
  "bot_id": "uuid",
  "workspace_id": "uuid",
  "workspace_name": "Acme",
  "workspace_icon": "https://...",
  "owner": { "type": "user", "user": { /* user object */ } },
  "duplicated_template_id": null
}
```

## Errors

| Failure | Status | Code |
|---------|--------|------|
| Missing Authorization on protected route | 401 | `unauthorized` |
| Malformed bearer | 401 | `unauthorized` |
| Revoked / expired token | 401 | `unauthorized` |
| Valid token, no permission on resource | 403 or 404 (see errors doc) | `restricted_resource` / `object_not_found` |
| OAuth code consumed twice | 400 | `invalid_grant` |
| OAuth client mismatch | 401 | `invalid_client` |

## `GET /v1/users/me`

Returns the user (or bot) identified by the bearer token. Used by SDK to validate credentials.

```json
{
  "object": "user",
  "id": "uuid",
  "type": "person" | "bot",
  "person": { "email": "alice@example.com" },
  "bot": { "owner": { "type": "workspace" | "user", "workspace": true }, "workspace_name": "Acme" }
}
```

## Test obligations

- Contract tests cover: valid bearer, malformed bearer, missing bearer, revoked bearer, oauth code happy path, oauth code reuse, oauth client mismatch.
- Chaos: bearer header injection attempts (CR/LF, very long values, null bytes) all return 400.