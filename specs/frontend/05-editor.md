# Block Editor Architecture

## Goals

- Block tree (not flat document) is the unit of editing.
- Per-block keyboard/rich-text behaviour identical to Notion (Backspace at start of a list collapses; Tab indents; Enter at empty list ends list).
- Multiplayer via Yjs.
- Pluggable block-type renderers; new types added via a register call.
- Server reads/writes go through the same op log as local edits.

## Why a custom editor

Tiptap, Lexical, ProseMirror, Slate are all excellent **document** editors but model the document as a single flat tree of inline + block nodes within one root. Notion is a **block** tree with type-specific child policies (e.g. `column_list` accepts only `column`s, `table` only `table_row`s) and per-block independent inline editors (each paragraph has its own selection contexts when collaboratively edited).

Our model: each text-bearing block carries its own inline editor (a thin layer over `Y.Text`). The block tree itself is rendered as a React component tree, with adjacency captured in `order: Y.Map<parentId, Y.Array<blockId>>` (see `docs/architecture/05-realtime-architecture.md#document-model`).

This avoids:

- Reconciling a global ProseMirror schema with our 32-type block set and its parent constraints.
- Yjs binding pain for nested mixed-content schemas.
- Performance issues from rerendering an entire page on every keystroke.

It does require:

- A custom selection model spanning blocks (range selection, multi-block selection).
- A custom command system.
- A custom plugin system for slash menu and formatting toolbar.

## Package layout (`packages/editor`)

```
src/
  block-tree/
    BlockTree.tsx         // root component
    Block.tsx             // type dispatcher
    useBlockChildren.ts
  rich-text/
    RichTextEditor.tsx    // controlled wrapper around Y.Text via contenteditable
    inline-decorations.ts // mention/equation/link inline rendering
    serializer.ts         // Y.Text → RichText[] and back
  selection/
    SelectionModel.ts
    useSelection.ts
  commands/
    Command.ts            // command interface
    insertBlock.ts
    deleteBlock.ts
    indent.ts / outdent.ts
    splitBlock.ts
    mergeBlocks.ts
    toggleAnnotation.ts
    transformBlock.ts     // e.g. paragraph → heading_2
  history/
    UndoManager.ts        // wraps Yjs UndoManager with per-page scope
  plugins/
    SlashMenuPlugin.ts
    FormattingToolbarPlugin.ts
    DragHandlePlugin.ts
    PastePlugin.ts
    DropPlugin.ts
  hooks/
  index.ts
```

## Document binding

- `useEditorDoc(pageId)` returns a Yjs document materialised from the API.
- `Y.Doc` is shared across all clients viewing the page via WebSocket.
- On unmount, persists outstanding updates and disconnects.

## Rendering

- `<BlockTree rootId={pageId} />` renders the page's root block, which dispatches to per-type components.
- Each text-bearing block uses `<RichTextEditor binding={blockYText} />`.
- Re-renders are surgical: a keystroke only re-renders the impacted block (Yjs change events scoped to `Y.Text`).

## Selection model

- Inline selection inside a single block: native `Range` / `Selection`.
- Cross-block selection: tracked in `SelectionModel` with `{ anchorBlockId, anchorOffset, focusBlockId, focusOffset }`.
- Visual representation: each spanning block adopts `data-selected="true"`; CSS paints `--bg-active`.
- Selection commands: extend up/down by block, by line.

## Command system

```ts
interface EditorCommand<I, O> {
  name: string;
  canExecute(ctx: EditorContext, input: I): boolean;
  execute(ctx: EditorContext, input: I): O;
}
```

All edits go through commands; the slash menu, toolbar, and keyboard handlers dispatch the same commands. Commands are pure (operate on Yjs doc + selection model), so they are testable and replayable.

## Keyboard handling

`useKeyboardHandlers()` registers global handlers; per-block components opt in to additional handlers via `data-block-type` matching.

Key behaviours (full table in `15-keyboard-shortcuts.md`):

- Enter at end of empty list/todo/toggle → outdent to paragraph (or escape list).
- Enter with selection collapsed → split block at cursor.
- Backspace at offset 0 → merge with previous block or transform to paragraph.
- Tab → indent (if first node after `Enter`-split); inside table → next cell.
- Shift+Tab → outdent.
- Cmd+B / Cmd+I / Cmd+U / Cmd+Shift+S / Cmd+E → toggle annotation.
- Cmd+K → insert link.
- Cmd+/ → page font/style menu.
- Cmd+Shift+L → toggle light/dark.
- / → slash menu.
- @ → mention popover.
- [[ → page mention.

## Paste

- Detect content kinds:
  - Plain text → as text node into current block.
  - HTML → parse via DOMParser, walk and map to blocks/inlines, normalise.
  - Markdown → if text + extension hint, parse via `remark`.
  - Image bytes → upload + insert image block.
  - URL (single) → option: paste as link / bookmark / embed / inline-link.
- Implementation in `plugins/PastePlugin.ts`.

## Drag handle (six-dot)

- Appears on hover at the left margin of each top-level block in the page (≥ md viewport).
- Drag: floats the block at 80% opacity; drop indicators on other blocks.
- Click: opens block menu (transform, color, duplicate, move to, copy link, delete).

## Plus button

- Appears next to the drag handle; click inserts a new empty paragraph below and opens the slash menu.

## Slash menu

See `09-slash-menu.md`.

## Formatting toolbar

See `10-formatting-toolbar.md`.

## Performance

- Virtualised long pages: blocks below the viewport (after a 50-block buffer) are mounted lazily on scroll. The block tree maintains positions for stable scroll.
- Block components use `React.memo` + Yjs subscriptions to avoid superfluous renders.
- `useLayoutEffect`-free hot paths.

## Tests

- Unit: each command, the serializer (round-trip RichText↔Y.Text), the selection model.
- Integration: simulate keystrokes against a real `Y.Doc`, assert resulting block tree.
- Playwright: every key behaviour from the shortcuts table.
- Visual: editor snapshot per block type and per state (empty, with content, hovered, selected, dragged).
- Performance: 1000-block page; type 100 chars; p99 frame time < 16ms.