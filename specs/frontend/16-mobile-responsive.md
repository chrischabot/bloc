# Mobile & Responsive Behaviour

Target: usable on viewports ≥ 360 px wide. Pixel-perfect parity with the notion.so web app (mobile web; not the native app).

## Breakpoints (recap)

| Breakpoint | Width | Sidebar |
|------------|-------|---------|
| xs | < 640 | drawer |
| sm | 640 – 767 | drawer |
| md | 768 – 1023 | drawer |
| lg | ≥ 1024 | inline |

## Mobile-specific behaviours

- **TopBar** drops breadcrumb truncation in favour of "<" back button + page title.
- **Sidebar** opens via swipe from left edge or the menu IconButton.
- **Drag handle / plus button** is hidden; long-press a block opens the block menu (transform, color, duplicate, delete) at the bottom as a sheet.
- **Slash menu** appears at the bottom of the viewport (bottom sheet) on touch devices.
- **Formatting toolbar** appears at the bottom of the viewport above the soft-keyboard.
- **Hover-only interactions** (e.g. row hover actions in sidebar) are replaced by long-press menus.
- **Database views**: table view scrolls horizontally with the title column sticky-left; board view scrolls horizontally with snap.

## Touch targets

- Minimum 44×44 px for interactive elements.

## Soft-keyboard accommodation

- `interactionchange` listener resizes the editor's scroll container so the caret stays visible above the keyboard.

## Tests

- Playwright with `iPhone 14` + `Pixel 7` + `iPad Pro 11` device descriptors.
- Visual snapshots per device per theme on canonical screens (sidebar, editor with content, database table, slash menu).