# Authentication & permissions

## Tokens

Every authenticated request carries an `Authorization: Bearer <token>` header. Bloc accepts three kinds of token:

| Kind | Lifetime | How you get one |
|---|---|---|
| **Internal integration** | Until revoked | `POST /v1/integrations` in the workspace settings UI |
| **Public OAuth** | Until revoked | OAuth 2.0 dance against `/v1/auth/oauth/*` |
| **Dev bootstrap** | 24 h | Printed in the web console on first load when `NODE_ENV=development` |

Tokens are opaque strings — don't try to parse them. Treat them as secrets and never embed them in client code shipped to a browser; integrations should call Bloc from your server.

## OAuth flow

1. **Redirect** the user to `GET /v1/auth/oauth/authorize?client_id=…&redirect_uri=…&state=…&scope=read,write`.
2. They approve in the consent screen, the browser is redirected back with `?code=…&state=…`.
3. Your server **exchanges** the code: `POST /v1/auth/oauth/token` with `{ grant_type: 'authorization_code', code, redirect_uri, client_id, client_secret }`.
4. You get back `{ access_token, refresh_token, workspace_id, workspace_name, bot_id, owner }`.

`Notion-Version` is required on the token exchange just as on every other call.

## Workspace, group, page ACLs

Bloc's permission model is three layers:

1. **Workspace membership** — a user is a `member` or `admin` of the workspace. Admins can manage settings, integrations, and audit. Members can see and edit anything the workspace owns by default unless a finer-grained ACL says otherwise.
2. **Group / teamspace** — a named bundle of users. Groups are referenced as grantees on page ACLs and as scope on integrations.
3. **Page ACL** — per-page `Permission` rows. Each grants a level (`full_access` / `can_edit` / `can_edit_content` / `can_comment` / `can_read` / `no_access`) to a grantee (`user` / `workspace` / `teamspace` / `group` / `public` / `link`).

When evaluating "can user X do Y on page P?":

1. Start at P, look at its ACL plus the ACLs of every ancestor (children inherit unless explicitly overridden).
2. If any grant matches X (user grant, group grant, workspace grant, `public`) at a level ≥ required, allow.
3. Else, deny with a `403 restricted_resource`.

The `me` endpoint at `/v1/pages/{id}/permissions/me` returns the effective level for the caller.

## Public links

Setting a `public` grantee on a page makes it reachable by URL without auth. The Sites publishing surface goes further: it generates a stable `public_url`, optionally maps a custom domain, and renders the page through the same v3 endpoints.

## Integration scopes

Internal and OAuth tokens carry scopes. The minimal set:

| Scope | Allows |
|---|---|
| `read` | `GET` everywhere |
| `write` | mutating ops on pages, blocks, properties |
| `manage_users` | `users` resource — list, invite, role changes |
| `manage_webhooks` | full CRUD on `/v1/webhooks` |
| `ai` | call `/v1/ai/*` |

Scope enforcement is layered on top of the page ACL — a `write` scope still can't bypass a `can_read` ACL grant.

## Practical guidance

- For dev: use the bootstrap token printed at first load, scope `*`, and don't sweat it.
- For a self-hosted production: create a workspace, log in as an admin, create one integration per logical caller (CI bot, exporter, etc.) — never share a token between callers.
- For a public OAuth app: store `refresh_token` server-side, refresh proactively at ~90% lifetime, never log access tokens.
