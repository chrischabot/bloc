# Settings

Two panes: **Account** (you) and **Workspace** (the org, admin-only for most rows).

## Account

| Row | What |
|---|---|
| **Profile** | Name, photo, email |
| **Preferences** | Theme (light/dark/auto), start week on Sunday/Monday, time zone, language |
| **Notifications** | Email digest cadence, web push, mobile push |
| **My connections** | Personal integrations (your Google Calendar, etc.) |
| **Sessions** | Active sessions, sign out from all devices |
| **Danger zone** | Delete account |

## Workspace

| Row | What | Role |
|---|---|---|
| **General** | Name, icon, public domain, default content language | Admin |
| **Members** | Invite, change role, remove | Admin |
| **Groups & teamspaces** | CRUD groups | Admin |
| **Plans & billing** | (self-hosted: empty; SaaS hosts add billing here) | Admin |
| **Sites** | Default theme, custom domains | Admin |
| **Imports** | Notion export / Markdown / CSV import | Member |
| **Connections** | Workspace-scoped integrations | Admin |
| **Identity & provisioning** | SAML / SCIM (when enabled) | Admin |
| **Security & data** | Session policy, audit retention, allowed email domains | Admin |
| **Audit log** | Search & export | Admin |
| **Insights** | Workspace analytics summary | Admin |

## Integrations (workspace-scoped)

Each integration row shows:

- Name + icon.
- Author / app id.
- Capabilities (scopes).
- Pages it can access.
- Last used.
- Revoke / Edit.

Add via **+ Add integration** — either install one of the built-ins (Slack, Google Drive, GitHub …) or paste an OAuth client id to bootstrap a new one.

## API tokens

For internal integrations (no OAuth dance), click **Create internal integration** in workspace settings. The token appears once. Store it. Set scopes at creation time.

## Custom domains

For sites publishing. Add a domain, copy the CNAME / TXT records, click **Verify**. Once verified, point any published page at it from the page-level share panel.

## Audit log UI

Search by actor, target, action, time. Export to CSV. Retention follows the workspace plan (default 180 days; see [Reporting](../reporting/08-analytics-and-audit.md)).
