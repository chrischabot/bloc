# App Layout

## Shell

```
┌──────────────────────────────────────────────────────────────────────────┐
│ TopBar (48px tall)                                                       │
├──────────┬───────────────────────────────────────────────────────────────┤
│          │                                                               │
│ Sidebar  │  ContentArea (scrolls)                                        │
│ (240–500)│   Page header (cover, icon, title, properties strip)          │
│          │   Editor body                                                 │
│          │                                                               │
└──────────┴───────────────────────────────────────────────────────────────┘
```

## TopBar (48px)

Layout left→right:

1. **Sidebar toggle** (only when sidebar collapsed) — IconButton, `panel-left` icon.
2. **Breadcrumb trail** — clickable parents to the current page, separated by `/`. Truncates with overflow menu when too long.
3. **Tab buttons** for opened views/pages (Notion's "open in side peek" model is supported; v1 omits multi-tab and renders a single breadcrumb).
4. **Flex spacer**.
5. **Share button** — opens share dialog.
6. **Comments toggle** — opens comments panel.
7. **Updates button** — bell icon with unread badge.
8. **Favourite toggle** — star icon.
9. **More menu** — three dots (page actions: duplicate, move to, copy link, export, delete).

Sticky to top of viewport; scrolls under shadow when content scrolls.

## Sidebar

See `04-sidebar.md` for details. Width persists per-user; range 240–500 px.

- Drag handle on right edge (`Resizer`) shows `col-resize` cursor.
- Collapse button at top-right of sidebar (or chevron) hides sidebar; TopBar gets a "show sidebar" IconButton.
- On `<lg` viewports the sidebar becomes a slide-in drawer.

## ContentArea

- Max width 720 px (default), 900 px (wide page), or full-width (toggle in page settings).
- Centred horizontally with `padding: 0 96px` on `>= xl`, `0 24px` on `<= md`.
- Page header sticks to top of content scroll until scrolled past title.

## Breakpoints

| Token | Min width | Behaviour |
|-------|-----------|-----------|
| `--bp-sm` | 640 | Sidebar overlays as drawer; topbar compact |
| `--bp-md` | 768 | Sidebar overlays |
| `--bp-lg` | 1024 | Sidebar inline; default |
| `--bp-xl` | 1280 | Wider padding |
| `--bp-2xl` | 1536 | Max content width 960 |

## Drag-and-drop

The shell supports drag-and-drop targets:

- Sidebar accepts page drop (reparent).
- Editor accepts file drop anywhere (creates file/image block).
- Page header cover accepts image drop (replaces cover).

## Loading state

When navigating between pages:

- Optimistic: title, breadcrumb, and icon swap instantly using cached metadata.
- Skeleton blocks while children load.
- < 100ms perceived first-paint target.

## Tests

- Playwright: open shell, resize sidebar, collapse, expand, navigate breadcrumb, share dialog open.
- Visual snapshots at each breakpoint.