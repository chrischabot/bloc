# Settings

Accessed via Sidebar → Settings or `/settings`. Opens a centred modal with left-rail navigation.

## Sections

### Account

- My account: name, email, profile photo, password, delete account.
- My notifications: email digests, mobile/desktop pushes (deferred).
- My connections: linked accounts (Google).
- Language & region.

### Workspace

- General: workspace name, icon, domain.
- People: members, guests, invite link, role management.
- Teamspaces: list, create.
- Plan & billing.
- Security: 2FA enforcement, allowed email domains, SSO (deferred).
- Identity & provisioning (deferred).
- Connections (workspace-level): integrations approved.

### Appearance

- Theme: System / Light / Dark.
- Density: Comfortable / Compact.
- Reduced motion toggle.

### My Integrations

- List of integrations the user created.
- Create new (raw token shown once; capabilities pick).
- Revoke.

### Connections

- Approved third-party apps; revoke.

### Import / Export

- Import from: Notion (paste public URL), Evernote, CSV, Markdown, HTML.
- Export workspace: JSON / PDF / Markdown.

## Behaviour

- Dirty form warning on leave.
- Save indicator (checkmark) per section.
- Destructive actions (delete account, leave workspace) require confirmation modal with type-to-confirm.

## Tests

- Unit: form validation per section.
- Playwright: update name, change theme, create + revoke integration.
- Visual: per section per theme.