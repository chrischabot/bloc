# Phase 8 — Block Editor

## Goal

Full rich-text + block tree editor with all 32 block types and Notion-equivalent keyboard behaviour.

## Read first

- `docs/frontend/05-editor.md`
- `docs/frontend/06-block-components.md`
- `docs/frontend/09-slash-menu.md`
- `docs/frontend/10-formatting-toolbar.md`
- `docs/frontend/11-page-header.md`
- `docs/frontend/15-keyboard-shortcuts.md`
- `docs/api/schemas/block-types.md`
- `docs/api/schemas/rich-text.md`
- `docs/architecture/05-realtime-architecture.md`

## Deliverables

1. `packages/editor` per the layout in `05-editor.md`.
2. BlockTree + per-type components for every block type.
3. RichTextEditor bound to `Y.Text`.
4. Slash menu plugin with the full item catalogue.
5. Formatting toolbar plugin with all annotations + colors + link.
6. Drag handle + plus button.
7. Multi-block selection.
8. Undo/redo (Yjs UndoManager scoped per page).
9. Paste handling for all kinds.
10. Image upload + crop + caption + alignment.
11. Code blocks with Shiki for 30+ languages.
12. Math (KaTeX) inline + block.
13. Toggle / synced / column / table interactions.
14. Page header (cover, icon, title, properties strip).
15. Tests: per command unit, per shortcut Playwright, per block type visual, 1000-block perf budget.

## Todos

- [ ] 8.1 Editor architecture
- [ ] 8.2 Rich text annotations
- [ ] 8.3 Inline mentions / equations / dates
- [ ] 8.4 All 32 block components
- [ ] 8.5 Slash menu
- [ ] 8.6 Formatting toolbar
- [ ] 8.7 Keyboard shortcuts
- [ ] 8.8 Drag handle + plus
- [ ] 8.9 Nested indentation
- [ ] 8.10 Undo/redo ≥ 100 steps
- [ ] 8.11 Paste handling
- [ ] 8.12 Image upload + crop
- [ ] 8.13 Code blocks 30+ langs
- [ ] 8.14 Math blocks
- [ ] 8.15 Toggle blocks
- [ ] 8.16 Synced blocks cross-page
- [ ] 8.17 Column blocks
- [ ] 8.18 Tables
- [ ] 8.19 E2E + visual regression

## Definition of Done

- Universal DoD.
- Pixel-perfect checklist for editor and page header ticked.
- 1000-block page typing latency p99 < 16ms; visual regression < 1% across all block stories.
- Multiplayer two-tab test: both tabs converge after 10s of concurrent random edits (fuzz).

## Pitfalls

- Selection state across Yjs updates is fragile; use Yjs `RelativePosition` for stable cross-edit anchors.
- Numbered list numbering across non-numbered siblings is subtle — write a focused Playwright test on this.
- Synced blocks: implement as a shared `Y.Doc` for the synced subtree, mounted into both parent docs via `Y.applyUpdate`.