# Connections & integrations

Two categories:

1. **Bloc → external** — Bloc reads from / writes to other services (Google Drive, Slack, GitHub …).
2. **External → Bloc** — other services call Bloc via the public API.

## Managing connections

**Settings → Connections** (admin):

- Add a connection (OAuth dance) — Bloc requests scopes from the upstream and stores tokens.
- Per-connection: which workspaces / users / pages can use it.
- Revoke at any time; tokens are flushed from Postgres.

## Built-in connectors

| Service | Capability |
|---|---|
| Google Drive | Embed Drive files; preview in editor |
| Google Calendar | Sync events into the [Calendar app](./calendar.md) |
| Slack | Push notifications; slash command to fetch a page |
| GitHub | Embed PRs / issues; inbox routing of mentions |
| Figma | Embeds |
| Loom | Embeds |
| Linear | Embeds + inbox routing |

Connector code lives under `apps/api/src/integrations/`; adding a new one is a matter of dropping a new module conforming to the `Integration` interface.

## Building a custom connector

The minimum a connector implements:

- `id`, `name`, `icon`.
- `oauth: { authorize_url, token_url, scopes }`.
- `on_install(workspace_id, token)` — provision side-effects.
- `on_uninstall(workspace_id)` — revoke side-effects.
- One or more **surfaces**:
  - `embed_resolver(url) → { type, data }` — render `bookmark` / `embed` previews.
  - `inbox_resolver(event) → InboxEntry` — when the upstream calls Bloc's connector webhook.
  - `tool(tool_call) → tool_result` — expose to the [AI agent](./ai-agent.md).

See `apps/api/src/integrations/builtin/` for examples.

## External → Bloc (the public API)

For external services wanting to call Bloc, the OAuth client lives under **Settings → Integrations → OAuth apps**:

- Set redirect URIs, scopes, logo.
- Bloc generates `client_id` and `client_secret`.
- Implement the OAuth flow against `/v1/auth/oauth/*` (see [API › Authentication](../api/02-authentication.md)).

## Webhooks

For event subscriptions, prefer webhooks over polling. See [API › Webhooks](../api/endpoints/webhooks.md).
