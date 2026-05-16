# Page Opening Modes

When a user clicks an open chevron / row in the editor or a database, the target page can render in one of three modes. The mode is chosen by:

1. The originating database's `open_as` setting (see `docs/frontend/25-database-page-layouts.md`).
2. Or the user's explicit choice via the keyboard / context menu.

## Modes

### Side peek

- A right-edge sliding panel, 60% of viewport width (min 480 px, max 960 px).
- Underlying surface remains visible and interactive (dimmed slightly).
- Esc or click-outside closes; the URL adds `?peek=<page_id>`.
- Multiple side-peeks stack (max 3): each new peek pushes the previous further left as a tiny rail.

### Center peek

- A modal centred over the viewport, 80% width × 80% height, with rounded corners and shadow.
- Background scrim at `--bg-overlay`.
- The route changes to the peek URL pattern but the underlying page state is preserved.

### Full page

- Navigates to the page's URL; pushes onto the history stack.

## Switching mode

- `Cmd+Shift+0` → side peek → center peek → full page (cycle).
- Each peek panel has a top-bar "Open as full page" IconButton.
- Right-click a link → "Open in side peek" / "Open in center peek" / "Open in new tab".

## Per-database default

`databases.config.open_as` in `'side_peek' | 'center_peek' | 'full_page'`. Applied when a row is clicked from any view of that database.

## Navigation history

- Browser back/forward respect peek state — back from a side peek closes the peek but keeps the underlying surface.
- A breadcrumb-internal history exists for breadcrumb forward/back arrows (`Cmd+[`, `Cmd+]`).

## Renderer

- Same editor component as the full-page renderer.
- Peek modes use `position: fixed` containers with their own scroll context.
- Editing in a peek mutates the same Y.Doc as the full-page edit; multiple windows of the same page stay in sync.

## Tests

- Playwright: click a row from a database with `open_as=side_peek`; assert peek panel visible.
- Visual: each mode at desktop + tablet breakpoints.
- Performance: peek open p99 < 200 ms (cached metadata).