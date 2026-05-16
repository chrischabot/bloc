# Backlinks & Reminders

## Backlinks

A **backlink** is a system-tracked edge: page A links to page B → page B has a backlink from A.

### Sources of backlinks

Any of these on page B creates a backlink to page A pointing back at B:

- Inline `@page` mention in B.
- `link_to_page` block in B targeting A.
- A relation property value on a database row in B pointing to a row in A's DB.

### Rendering on a page (`docs/frontend/11-page-header.md`)

Below the page header, a **Backlinks** section reveals the inbound references. Three display modes (per page settings; for database rows, controlled by `databases.config.backlinks`):

| Mode | Effect |
|------|--------|
| `Expanded` | Inline list under the title: page icon + title + snippet of the linking block. Up to 10 visible; "Show all" reveals the rest. |
| `Show in popover` | Collapsed pill at the top of the page body: "2 backlinks"; clicking opens a popover. (See `screenshots/page-style-backlinks.png`.) |
| `Off` | Hidden entirely. |

### Implementation

- Source of truth: a `backlinks` materialised table updated by the indexer worker on every page mutation:

  ```
  backlinks (
    source_page_id uuid,
    target_page_id uuid,
    source_block_id uuid NULL,
    kind text CHECK in ('mention','link_to_page','relation'),
    created_at timestamptz,
    PK (source_page_id, target_page_id, source_block_id, kind)
  )
  ```

- On block insert/update/delete, the indexer scans rich-text for mentions and `link_to_page` blocks; on database row mutation it scans relation properties.
- Reads filter by ACL: a backlink is shown only if the viewer can read both source and target.
- A "broken backlink" (target archived) is hidden from rendering but kept in the table for 30 days.

### API

- `GET /v1/pages/:id/backlinks?page_size=100&start_cursor=...` — paginated list.
- Response item: `{ source_page_id, source_block_id, kind, snippet }`.

### Tests

- Integration: mention page B from page A → backlink visible on B within 2s.
- Chaos: deleting page A archives backlinks pointing from it; reviving restores.
- Observability: backlink mutations emit `backlink.created` / `backlink.removed` spans.

## Reminders

A **reminder** is a special inline date mention (`@reminder`) that triggers a notification at the specified time.

Reference: `screenshots/comments-reminders-reference.png`, `screenshots/comments-mention-date.png`.

### Creation

- In any rich-text block or comment: `@` → pick **Reminder** → date picker.
- Or type a date mention then click "Remind" on the popover.
- Choices: `On the day`, `1 hour before`, `1 day before`, `2 days before`, `1 week before`, `Custom`.

### Rendering

- Inline pill with bell icon + the date.
- After firing, the pill switches to "✓ Notified".

### Delivery

- Worker job `apps/worker/src/jobs/fire-reminder.ts` runs every minute.
- Selects reminders where `fire_at <= now() and notified_at is null`.
- Creates an inbox `reminder` notification for the mentioning author and any explicitly tagged users (`@reminder for @bob`).
- If the workspace has email digests enabled, the reminder also goes to email.

### Data model

```
reminders (
  id uuid PK,
  page_id uuid,
  block_id uuid,
  inline_offset int,                -- char offset in the rich_text array for stable updates
  fire_at timestamptz NOT NULL,
  created_by uuid,
  recipients uuid[],
  notified_at timestamptz NULL
)
```

### API

- `GET /v1/users/me/reminders` — upcoming + past 30 days.
- Reminders are written automatically as part of rich-text validation when a mention of `type: date` carries `reminder: { offset_minutes: int }`.

### Tests

- Integration: add reminder for 1 minute from now → assert inbox notification within 90s.
- Chaos: reminder in the past, reminder >1y future, reminder on archived page (skipped).