# Sidebar

## Structure (top → bottom)

1. **Workspace switcher** — current workspace name + chevron; clicking opens a popover with: workspaces list, "Create or join a workspace", "Log out", invite people.
2. **Quick actions** (icon row): Search · **AI** (opens the Agent panel — see `docs/frontend/18-ai.md`) · Home (opens `/home` — see `docs/frontend/24-home-dashboard.md`) · Inbox · Calendar · Settings · New page.
3. **Section: Favourites** — pinned pages; hidden when empty.
4. **Section: Teamspaces** — workspace-shared spaces; expandable. A teamspace can be configured as a **wiki** (see `docs/frontend/27-wikis-verification.md`); wiki teamspaces show a small open-book glyph next to the name.
5. **Section: Shared** — pages shared with me but not in a teamspace.
6. **Section: Private** — pages I own that aren't shared.
7. **Footer**: Templates · Import · Trash · Help · "+ New page" sticky.

Each section header is a button that toggles collapsed/expanded; state persists per-user.

## Page tree

Within each section, pages form a hierarchical tree:

- Indent = 14 px per level.
- Each row: chevron (collapsed/expanded), icon, title, action buttons on hover (plus, more).
- Chevron is hidden when the page has no children; loading is lazy on expansion.
- Hover row: row tinted `--bg-hover`, two icon buttons appear right-aligned (plus to add child page, more for actions).
- Active page: bold title, `--bg-active`, persistent accent indicator strip on the left (3 px).
- Right-click row → context menu (rename, duplicate, copy link, move to, add to favourites, delete).

## Drag-and-drop

- Drag a page row → drop on another row's body to reparent, drop in the gap to reorder.
- Drag preview: 80% scaled card with title + icon.
- Drop indicators: blue line at gap; tinted body for reparent.
- DND backed by `dnd-kit`.

## Sections

### Workspace switcher details

- Active workspace shown with its icon + name.
- Chevron down → popover (320 px wide):
  - List of workspaces; each: icon, name, "current" tag, member count.
  - "Create or join workspace" link.
  - Separator.
  - "Settings & members" link.
  - "Log out" link.

### Search button

Opens **Quick Switcher** (Cmd+K / Ctrl+K). See `13-search-ui.md`.

### Updates (inbox)

Opens a slide-over drawer. See `12-comments-ui.md#inbox`.

### Settings

Navigates to `/settings`.

### New page

Creates an empty private page; opens it in the editor with focus on the title.

## Footer

- Templates → opens templates gallery.
- Import → opens import dialog.
- Trash → opens trash popover (recent deletions; click to restore).
- Help (bottom-right) → popover with: send feedback, what's new, keyboard shortcuts, contact support.

## Empty states

- Private with no pages: "Add a page" CTA with a + button.
- Favourites empty: section hidden.
- No teamspaces: section hidden until first created.

## Visual reference

`reference/screenshots/sidebar-*.png` covers:

- Collapsed.
- Expanded with private + shared + teamspaces.
- Hover on a row.
- Drag-in-progress.
- Workspace switcher open.

## Tests

- Unit: each row component (states default/hover/active).
- Integration: page tree fetch + lazy expansion.
- Playwright: drag-and-drop reparent, drag-to-reorder, right-click menu, search open via Cmd-K, new page creation.
- Visual: per state.