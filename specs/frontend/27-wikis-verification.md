# Wikis & Page Verification

A **wiki** is a special configuration of a page: it becomes a directory for a subset of the workspace's knowledge, with **owners** responsible for **verifying** sub-pages on a recurring schedule.

## Turn a page into a wiki

Page top-bar three-dot menu → **Turn into wiki**. Effect:

1. The page gains the `is_wiki = true` flag.
2. A `wiki_index` block is inserted at the top: a sortable / filterable index of every descendant page with columns `Title`, `Owner`, `Verification`, `Last edited`.
3. A new sub-page in this wiki inherits an `owner` property and a `verification` property.

## Owner property

- Type: `people` (multi-allowed).
- A wiki sub-page must have at least one owner.
- Owners receive verification-expiry notifications.

## Verification property

- Type: `verification` (new property type).
- Value shape: `{ state: 'verified'|'unverified', verified_by: uuid|null, verified_at: timestamptz|null, expires_at: timestamptz|null }`.
- States:
  - **Unverified** (default).
  - **Verified** — set by an owner via the "Verify" button at the top of the page; user picks an expiry: `7d`, `30d`, `90d`, `1y`, `Never`.
- On expiry, the property auto-flips to `unverified`; an inbox notification fires to the owners.

## UI

- In a wiki sub-page header, a verification chip renders next to the title:
  - `✓ Verified — expires in 12d` (green).
  - `⚠ Verification expired` (amber).
  - `Verify` button (only for owners).
- In the wiki index, the Verification column shows the chip per row.

## Data model

`pages.is_wiki bool`. Add property type `verification` to `database_properties.type`; values stored polymorphically in `page_properties.value`. (Wiki sub-pages are page rows of an implicit database created when turning into a wiki, OR — to match Notion — sub-pages of the wiki page with the owner/verification stored on the page itself via a magic property set. The implementation uses an implicit database under the hood so we leverage the existing property infrastructure.)

## API

- `POST /v1/pages/:id/wiki` — turn the page into a wiki.
- `DELETE /v1/pages/:id/wiki` — turn off; downgrades to a normal page; verification properties become hidden.
- `POST /v1/pages/:id/verify` — body `{ expires_in_days | null }`.
- `POST /v1/pages/:id/unverify`.

## Tests

- E2E: turn a page into a wiki; add a sub-page; set owner; verify; expire (using a frozen clock); confirm chip flips and notification fires.
- Visual: chip states.
- Chaos: non-owner tries to verify → 403; sub-page without owner cannot be verified → 422.
- Observability: verification state changes emit audit events.