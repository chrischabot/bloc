# Search UI

## Quick switcher (Cmd-K)

- Modal centred at top of viewport, width 640 px, max-height 480 px.
- Input at top; "Search Acme Workspace…" placeholder.
- Sections (when query empty):
  - **Recent** — last 5 visited pages.
  - **Suggested** — recent edits.
- Sections (when query non-empty):
  - **Pages** — title match first, snippet second.
  - **Databases**.
  - **Help & support** (deferred).
- Each row: icon, title, parent breadcrumb (greyed).
- Keyboard:
  - ↑ / ↓ navigate.
  - Enter open.
  - Cmd+Enter open in side peek (deferred).
  - Tab cycles filter chips ("In current workspace", "By person", "By date", "By type").
- Backed by `/v1/search`.

## Full search page

- Route `/<workspaceSlug>/search?q=...`.
- Three-pane layout:
  - Filters (left, 240 px): type (page / db), person, date range, parent.
  - Results (centre): list of cards.
  - Preview (right, 480 px, optional): selected result's first 30 blocks.
- Sort: relevance / last edited / created / title.

## Highlighting

- Server returns match offsets in title/snippet.
- Render with `<mark>` segments using `--bg-yellow_background`.

## Empty / loading / error states

- Loading: skeleton rows.
- Empty: "No results found for '<q>'".
- Error: toast + retry CTA.

## Tests

- Playwright: open switcher with Cmd-K, type query, navigate, open.
- Visual: snapshot per state.
- Latency: switcher first results within 300 ms of keystroke (cached recent) or 500 ms (fresh search).