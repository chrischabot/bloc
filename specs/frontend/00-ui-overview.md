# UI Overview

## Surfaces

The product has these top-level surfaces, all reachable from the sidebar:

| Surface | Route | Purpose |
|---------|-------|---------|
| Page | `/<workspaceSlug>/<pageId>` | A page (with or without database parent) |
| Database | embedded in page; opened via `/<workspaceSlug>/<databaseId>` for full-page databases | View + edit a database |
| Search | `/<workspaceSlug>/search?q=...` | Full-text search |
| Inbox | `/<workspaceSlug>/inbox` | Updates, mentions |
| Trash | `/<workspaceSlug>/trash` | Archived items |
| Settings | `/<workspaceSlug>/settings/<section>` | Workspace & user settings |
| Templates gallery | `/<workspaceSlug>/templates` | Template picker |

The default landing route after sign-in is the user's last-visited page or, if none, the workspace home page.

## Top-level layout

```
┌────────────────────────────────────────────────────────────────┐
│ TopBar (workspace switcher · breadcrumb · share · ··· · search)│
├──────────────┬─────────────────────────────────────────────────┤
│              │                                                 │
│   Sidebar    │             Content area                        │
│              │   (page editor | database view | search etc)    │
│              │                                                 │
└──────────────┴─────────────────────────────────────────────────┘
```

- Sidebar collapsible (drag handle on right edge, persists width 240–500 px) and fully hideable.
- TopBar always visible.
- Content area scrolls independently of TopBar/Sidebar.

## Component map

| Doc | Component |
|-----|-----------|
| `01-design-system.md` | Tokens (color, type, spacing), iconography |
| `02-component-library.md` | Primitives: Button, IconButton, Tooltip, Popover, Menu, Modal, Dialog, Toggle, Toast, etc. |
| `03-layout.md` | App shell |
| `04-sidebar.md` | Sidebar + page tree |
| `05-editor.md` | Block editor architecture |
| `06-block-components.md` | Per-block rendering |
| `07-database-views.md` | Table, board, gallery, list, calendar, timeline |
| `08-database-properties-ui.md` | Per-property cell editor, filter UI, sort UI |
| `09-slash-menu.md` | Slash command palette |
| `10-formatting-toolbar.md` | Floating selection toolbar |
| `11-page-header.md` | Page header (cover, icon, title, properties strip) |
| `12-comments-ui.md` | Inline + thread comments |
| `13-search-ui.md` | Quick switcher and full search |
| `14-settings.md` | Settings panels |
| `15-keyboard-shortcuts.md` | Every keybinding |
| `16-mobile-responsive.md` | Mobile breakpoints and behaviour |
| `17-pixel-perfect-checklist.md` | Acceptance checklist for visual parity |

## Pixel-perfect target

The product must be **visually indistinguishable from notion.so to a careful observer at the same viewport size** (taking into account user theme, browser font rendering, and locale).

Tests live in `tests/visual/` with reference screenshots in `reference/screenshots/`. The pipeline:

1. `tools/screenshot/` fetches reference shots from notion.so + documentation pages.
2. `tests/visual/` opens each surface in our app at the same viewport and theme, screenshots, and compares with pixelmatch.
3. < 1% diff (excluding documented anti-alias variance) is required to pass.

## Accessibility

WCAG 2.2 AA target. The agent must implement:

- Keyboard-only navigation for every interactive element.
- Visible focus rings (theme-token `--accent-focus`).
- Semantic landmarks (`<header>`, `<nav>`, `<main>`, `<aside>`).
- ARIA roles only where native semantics aren't sufficient.
- Sufficient contrast (the dark + light palettes already meet 4.5:1 for body text; verify on every component).
- Live-region announcements for: page-save success, block deletion, comment posted.

## Animation system

- Transitions: 120ms `cubic-bezier(0.16, 1, 0.3, 1)` (standard ease-out) for hover/focus.
- 220ms for menu/modal/popover open.
- 320ms for sidebar collapse + page transition.
- `prefers-reduced-motion: reduce` → transitions to 0ms; opacity-only fades retained.

## State management

- Server state: TanStack Query v5 with HTTP cache keyed by resource path.
- Client state: small Zustand stores for: editor focus, slash menu, modal stack, toast queue, ui prefs (theme, sidebar width).
- Realtime / collab state: Yjs `Y.Doc` per open page (see `docs/architecture/05-realtime-architecture.md`).

## Tooling

- Storybook for every component in `packages/ui` and `packages/editor`.
- Chromatic-style visual snapshot per component story (uses Playwright).
- Component generator in `tools/codegen/component.ts` produces file + story + test scaffolding.