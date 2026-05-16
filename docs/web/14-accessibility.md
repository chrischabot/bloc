# Accessibility

The Bloc web app targets WCAG 2.1 AA. Where we fall short, file an issue.

## Keyboard

- **Tab order** — every interactive element is reachable in DOM order.
- **Focus visibility** — every focusable element has a visible focus ring (don't override `outline: none` without a replacement).
- **Skip links** — "Skip to content" appears as the first tab stop on every page.
- **Slash menu, sidebar, search overlay** — all keyboard-navigable with ↑ / ↓ / ↵ / Esc.
- See [Keyboard shortcuts](./13-keyboard-shortcuts.md).

## Screen readers

- Every block exposes a `role` and an `aria-label`.
- Block-tree navigation uses `aria-owns` so siblings and children are predictable.
- Realtime updates announce changes via a live region (`aria-live="polite"`).
- Comments are exposed as a separate region with `aria-labelledby` pointing at the anchor.

## Colour & contrast

- Default text on default background is at least 4.5:1 in both themes.
- The colour palette has a `*_background` variant for highlight use — backgrounds and foregrounds are paired to stay 4.5:1.
- Code blocks meet AA in light and dark themes.

## Motion

- The settings page exposes a **Reduce motion** toggle. With it on, transitions are 0 ms.
- The setting honours `prefers-reduced-motion` from the OS by default.

## Text scaling

- The app respects browser zoom up to 200%.
- Long text wraps; no horizontal scrollbars at the canvas level.
- The sidebar collapses to icons at narrow widths but stays operable.

## Mobile / touch

- All controls have a minimum 44×44 touch target.
- Hover-only interactions (drag handle, block menu) have an on-tap equivalent.

## Known limitations

- **Drag-and-drop** between deeply nested blocks is keyboard-accessible but slow; we're tracking a better keyboard reorder UX.
- **Complex database views** (calendar, timeline) are visual-first; screen-reader use is supported but the experience favours the linear table view.

File accessibility bugs with the `a11y` tag in the issue tracker — they're a release blocker.
