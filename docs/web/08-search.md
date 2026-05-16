# Search

⌘K / Ctrl+K opens global search anywhere.

## What's searched

- Page titles.
- Page body text (every rich-text block).
- Database property values configured as searchable (defaults: title, rich_text).
- Comment bodies.
- People — name, email.

Results respect ACL — you only see pages you can read.

## Filters

The bar above the input toggles:

- **Type:** Pages / Databases / People / All.
- **In:** Workspace / Teamspace / Current page (recursive descendants).
- **Sort:** Best match / Last edited.
- **Date:** Anytime / Last week / Last month / Last year.

## Results

Each row shows:

- Icon, title, breadcrumb.
- Snippet with the matched substring highlighted.
- Last-edited timestamp.
- Author avatar.

Press ↑ / ↓ to navigate, ↵ to open, ⌘↵ to open in side peek, ⌘⇧↵ to open in a new tab.

## Saved searches

Useful queries can be saved from the search overlay's "•••" menu. They appear under "Saved" at the top of the sidebar. Saved searches re-query live on every open — they're not snapshots.

## Index lag

Bloc's index lags writes by a few seconds. If a freshly created page doesn't appear immediately, search will catch up in < 5 s under normal load. See [Reporting › Metrics](../reporting/03-metrics.md) — `search_index_lag_seconds`.

## Advanced syntax

| Term | Effect |
|---|---|
| `"exact phrase"` | Match the phrase verbatim |
| `-word` | Exclude pages containing the word |
| `in:Engineering` | Restrict to pages under "Engineering" |
| `type:database` | Restrict to databases |
| `by:alice` | Restrict to pages last-edited by Alice |
| `before:2025-05-01` | Last-edited before this date |
| `after:2025-04-01` | Last-edited after this date |

Combine freely. The syntax is lenient — unrecognised modifiers fall back to free-text terms.
