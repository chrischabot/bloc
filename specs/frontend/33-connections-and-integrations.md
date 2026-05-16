# Connections & Integrations

Three related but distinct surfaces:

1. **My Connections** — per-user OAuth links (Google, Microsoft, Slack, etc.).
2. **Workspace Connections** — workspace-approved third-party apps; admin curates.
3. **My Integrations** — developer-created integrations (bearer tokens or OAuth apps).

## My Connections

Route: `Settings → My connections`.

- Cards per provider: status (connected / disconnected), connected account, scopes granted, `Manage` (open provider settings), `Disconnect`.
- Providers (v1 list): Google, Microsoft, GitHub, Slack, Figma, Jira, Linear, Salesforce, Zendesk, Asana, Trello, Loom, Tableau, Notion Mail (above).
- Reconnect flow on token expiry surfaces a banner at the top of the workspace.

## Workspace Connections

Route: `Settings → Workspace → Connections` (admin only).

- Per app: enabled toggle, default access scope (`all members`, `selected teamspaces`).
- "Request to install" workflow for non-admin members: queued for admin approval; notifies via inbox.
- App detail: scopes, last-installed, member-coverage chart.

## My Integrations

Route: `Settings → My integrations`.

- "Create new integration":
  - Internal (bearer token) or Public (OAuth client + redirect URIs + secret).
  - Capabilities multi-select per `docs/architecture/06-authentication.md#integration-tokens`.
- Token shown once on creation; copy + confirm.
- Per integration:
  - Connected workspaces.
  - Webhook subscriptions (links to `docs/api/endpoints/webhooks.md`).
  - Recent activity (last 100 API calls).
- Revoke.

## Audit

- Connect / disconnect / revoke each writes `audit_events`.
- Public OAuth app installs log the installer + scopes.

## API

- `GET /v1/connections` / `DELETE /v1/connections/:id` — user-scoped.
- `GET /v1/workspaces/:id/connections` / `PATCH` / `DELETE` — workspace-scoped (admin).
- `POST /v1/integrations` (already specified in `docs/api/endpoints/auth.md`).
- `POST /v1/integrations/:id/connect` — install into a workspace via OAuth.

## Tests

- E2E: connect a stub provider, verify Connection appears in My Connections; disconnect, assert audit event.
- Visual: each panel light + dark.
- Chaos: malformed provider responses, OAuth state mismatch, scope downgrade attempts → 400.