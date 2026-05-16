# Tour of the interface

The Bloc web app at `apps/web` is a single-page experience modelled after notion.so. Three primary regions:

```
┌──────────────────────────────────────────────────────────────┐
│                 Top bar  (breadcrumbs, search, share)        │
├──────────────┬───────────────────────────────────────────────┤
│              │                                               │
│              │                                               │
│   Sidebar    │              Editor / page canvas             │
│              │                                               │
│              │                                               │
│              │                                               │
├──────────────┴───────────────────────────────────────────────┤
│                  Status bar  (presence, sync)                │
└──────────────────────────────────────────────────────────────┘
```

Right-side panels slide in for comments, AI, version history, and page settings — they overlay the editor without resizing it.

## What's on the top bar

- **Breadcrumb** — the page's ancestry. Click any segment to navigate.
- **Sidebar toggle** — collapses to a vertical strip.
- **Search** — global search across all pages and databases (⌘K / Ctrl+K).
- **Share** — opens the sharing panel.
- **AI** — opens the AI panel (Writer / Q&A / Agent / Autofill).
- **Updates** — pulls open Inbox.
- **Avatar menu** — settings, sign out.

## What's on the sidebar

- Workspace switcher (top).
- Quick actions: Inbox, Search, Home, Settings.
- Page tree with drag-to-reorder.
- "Shared" section — pages others have shared with you.
- "Favorites" — pinned pages.
- "Teamspaces" — group-scoped folders.
- "Trash" — soft-deleted items.

See [Sidebar & navigation](./02-sidebar.md).

## What's in the canvas

The canvas renders a page. Inside a page you'll see one of:

- A document — a tree of blocks.
- A database — a view (table, board, list, gallery, calendar, timeline) with rows.
- A wiki home — a curated grid of links + a verifying owner.

Hovering a block reveals the drag handle (`⋮⋮`) on the left; clicking the handle opens the block menu (turn into, duplicate, comment, delete, …). Hover anywhere between blocks for the `+` button — clicking it inserts a paragraph block; clicking with cmd/ctrl opens the slash menu.

## Right panels

| Panel | Opens via | What it does |
|---|---|---|
| **Share** | top bar | Page ACL grants + public link |
| **Comments** | comment icon on a block | Discussion threads for the selected block (or whole page) |
| **AI** | top bar | Surfaces — Writer / Q&A / Agent / Autofill |
| **Version history** | page menu | Browse and restore prior versions |
| **Page info** | page menu | Created/edited times, word count, ACL summary |

## Status bar

- Presence — avatars of other users currently on this page, with a cursor color.
- Sync state — `synced` / `syncing…` / `offline (N pending)`.
- Connection state — quiet by default; turns red when the WS is disconnected.
