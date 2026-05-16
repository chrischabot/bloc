# Notion Mail

A Notion-native mail client. Connects to Gmail / iCloud / Microsoft via OAuth, presents a unified inbox, and lets users use Notion blocks, AI, and links across their email.

Reached from sidebar quick-actions → **Mail**, or `/<workspaceSlug>/mail`.

## Layout

```
┌──────────┬─────────────────┬──────────────────────────────────────┐
│ Mailboxes│ Threads (list)  │  Reading pane                        │
│ ─ Inbox  │ ─ Subject       │   From · To · Date                   │
│   12     │   Snippet       │   ──────────────────────────────     │
│ ─ Done   │ ─ Subject       │   Body (rich; renders inline blocks) │
│ ─ Sent   │ ...             │                                      │
│ ─ Drafts │                 │   Quick reply composer at bottom     │
│ ─ Labels │                 │                                      │
└──────────┴─────────────────┴──────────────────────────────────────┘
```

Three resizable panes; columns collapse on small viewports per `docs/frontend/16-mobile-responsive.md`.

## Mailboxes

- **Inbox** with smart sub-sections (Notion auto-classifies on receipt):
  - **For you** — direct addresses, replies.
  - **News** — newsletters, marketing.
  - **Notifications** — automated system mail.
  - **Pinned** — user-pinned threads.
- **Done** — archived threads.
- **Sent**, **Drafts**, **Spam**, **Trash**.
- Labels — user-defined; multi-select per thread.

## Threading

- Threads grouped by `In-Reply-To` / `References` headers; subject normalisation is a tie-breaker.
- A thread shows participant avatars, count, last activity.

## Composer

- Rich text composer with **block editor parity**: `/` opens the slash menu restricted to email-safe blocks (paragraph, headings, bulleted/numbered list, to_do, quote, callout, code, divider, image, file, table, link, mention, equation).
- `@mention` a Notion page → renders as a clickable card on send; the recipient sees a fallback link if not signed in.
- Attachments via paperclip; max 25 MB / message (Gmail-compatible).
- **Templates**: reuse Notion templates (`/template`) — saved drafts available across threads.
- Snippets: `;sig` etc. — workspace-shared.
- AI **Compose** + **Refine selection** wired to `docs/frontend/18-ai.md` Writer.
- Schedule send (date + time picker).
- Track opens / clicks (optional, per-workspace policy).

## Thread actions

Top-bar of the reading pane:

- **Reply / Reply all / Forward**.
- **Done** (archive) / **Snooze ▾** (later today, tomorrow, next week, custom).
- **Label ▾**.
- **Convert to Notion page** — creates a page in the current workspace with the thread as a quote block + a backlink to the email.
- **Create task** — creates a row in a tasks database with subject as title, From as person, body excerpt as description.
- **AI summarise** — inline Notion AI summary above the body.

## Search & filters

- Top search input — operators: `from:`, `to:`, `subject:`, `label:`, `has:attachment`, `before:`, `after:`.
- Saved searches in the left rail.

## Smart filters & rules

User-defined rules:

- **When** an email matches a query.
- **Do** any of: label, archive, mark done, forward, pin, send to a Notion database (via the same step engine as automations).

## Sources & sync

- OAuth connect: Gmail, iCloud, Microsoft.
- Sync runs every minute (push-supported providers) or every 5 minutes.
- Local search index (MeiliSearch) per user keeps search instant.

## Data model

```
mail_accounts (
  id uuid PK, user_id uuid, provider text, external_account text,
  oauth_token_id uuid, last_sync_at timestamptz, push_token text NULL
)
mail_threads (
  id uuid PK, account_id uuid, external_thread_id text,
  subject text, last_message_at timestamptz, snippet text,
  category text CHECK in ('for_you','news','notifications','pinned'),
  state text CHECK in ('open','done','snoozed','spam','trash'),
  snoozed_until timestamptz NULL,
  PK_unique (account_id, external_thread_id)
)
mail_messages (
  id uuid PK, thread_id uuid, external_message_id text,
  from_address text, to_addresses text[], cc_addresses text[], bcc_addresses text[],
  sent_at timestamptz, body_html text, body_blocks jsonb,
  has_attachments bool, attachment_ids uuid[],
  in_reply_to text NULL, headers jsonb
)
mail_labels (id uuid PK, user_id uuid, name text, color text)
mail_thread_labels (thread_id, label_id, PK)
mail_rules (id uuid PK, user_id uuid, query jsonb, steps jsonb, enabled bool)
```

## API

- `GET /v1/mail/accounts` / `POST` / `DELETE`.
- `GET /v1/mail/threads?mailbox=&label=&q=&start_cursor=&page_size=` — list.
- `GET /v1/mail/threads/{id}` — with messages.
- `POST /v1/mail/messages` — send (body: `{ from_account_id, to, cc, bcc, subject, body_blocks, attachments, schedule_at? }`).
- `PATCH /v1/mail/threads/{id}` — state changes (done, snoozed, labels).
- `POST /v1/mail/rules` / `PATCH` / `DELETE`.
- `POST /v1/mail/threads/{id}:convert_to_page` — body `{ parent }`.
- `POST /v1/mail/threads/{id}:create_task` — body `{ database_id }`.

## Pixel-perfect items (append into `17-pixel-perfect-checklist.md` later)

- 3-pane layout proportions (260 / 400 / flex).
- Inbox sub-section icons + counts.
- Thread row hover background + density modes.
- Snooze popover layout and presets.

## Tests

- Integration: send via stub provider asserts outbound + thread state.
- Chaos: malformed MIME, 25 MB+1 byte attachment (413), provider OAuth expired → 401 with refresh hint, rule loop (rule routes own output back to inbox) detected and aborted.
- Observability: `mail.thread.<verb>` + `mail.message.send` spans; `mail_sync_lag_seconds` gauge.