# Sharing & permissions

Click **Share** in the top bar to open the sharing panel for the current page.

## Panel layout

1. **People with access** — list of grantees and their levels.
2. **Add people, groups, or teamspaces** — typeahead.
3. **Workspace access** — toggle "Anyone in <workspace>" and pick a level.
4. **Web access** — toggle public link; level is implicitly `can_read`.

## Levels

| Level | What |
|---|---|
| **Full access** | Read, edit, comment, share with others, delete |
| **Can edit** | Read, edit, comment |
| **Can edit content** | Read, edit blocks; can't change properties on database rows |
| **Can comment** | Read + comment |
| **Can view** | Read only |
| **No access** | Explicit deny — masks any inherited grant |

`Full access` is required to change permissions on a page.

## Public links

Toggle "Share to web" → Bloc generates a public URL. Options:

- **Allow editing** — typically off for public pages.
- **Allow comments** — toggle.
- **Allow duplication as template** — visitors can copy the page into their own workspace.
- **Search engine indexing** — off by default.

To remove public access: toggle off; the URL becomes 404 to anonymous visitors.

## Inheritance

Pages inherit ACL from their parent. Adding a grant on a child overrides inheritance for that grantee only. To completely break inheritance, grant `No access` to "Anyone in <workspace>" on the child.

The little ⓘ next to a grantee in the panel shows whether the grant is direct or inherited.

## Invites

Inviting someone who isn't yet a workspace member sends them an email with a sign-up link. They join as a member (not admin); admins can elevate from Settings → Members.

## OAuth / external apps

Listed in workspace settings under **Integrations**. Each integration shows its scopes and which pages it can access. Revoke from the same panel.

## Audit

Every share change is recorded in the audit log — see [Reporting › Analytics & audit](../reporting/08-analytics-and-audit.md).
