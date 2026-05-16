# Inbox & reminders

## Inbox

A unified feed of things that happened that you should look at.

| Entry kind | Triggers |
|---|---|
| **Mention** | Someone @ed you in a page or comment |
| **Comment** | A new comment in a thread you're in (or own) |
| **Page update** | A page you follow was edited |
| **Reminder** | A reminder you set fired |

Open via the sidebar **Inbox** row, or top bar bell icon.

## Inbox UX

- **Tabs** — All / Mentions / Comments / Updates.
- **Filter** — by sender, by page.
- Each entry shows: who, what, snippet, when.
- Click an entry → jumps to the underlying anchor (block / comment / page).
- Mark read / unread — auto on open, manual via the row menu.
- Snooze — push the entry out by a duration; it returns at that time.
- Archive — hides the entry without firing the "mark read" telemetry.

## Reminders

Create:

- Inside a date property — the property editor has "Add reminder" with a relative-time picker.
- Inside a date mention — click the mention → "Remind me".
- Slash → `/reminder` (creates a stand-alone reminder block).

Fire policy:

- At `due_at`, the worker writes an inbox entry of kind `reminder` for the assigned user.
- Optionally emails the user if their notification settings allow.

Manage reminders from the user menu → **Reminders**. Future and past lists. Edit `due_at`, label, assignee. Delete to remove.

## Notifications channels

| Channel | Source | Configurable |
|---|---|---|
| **In-app** | Always — populates the inbox | No |
| **Email digest** | Worker | Per-user cadence: realtime / hourly / daily / off |
| **Web push** | Browser | Per-user opt-in |
| **Slack / etc** | Workspace integration | Per-integration |

Configure in **Account → Notifications**.

## Inbox retention

Inbox entries are retained 90 days, then aged out by the worker's sweep. There's no public API to delete an entry; archive/snooze cover the user-facing needs.
