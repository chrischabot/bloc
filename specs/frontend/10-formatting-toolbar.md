# Formatting Toolbar

A floating toolbar that appears when there is a non-collapsed text selection inside a text-bearing block.

## Position

- Above the selection by 8 px.
- Horizontal: centred on selection midpoint, clamped to viewport.
- Re-positions on scroll/selection change.
- Hides on selection collapse, blur, or Esc.

## Layout (left to right)

| Group | Item | Shortcut |
|-------|------|----------|
| Transform | Block type dropdown (Text / H1/2/3 / List variants / Quote / Code / Toggle / Callout) | |
| Annotations | Bold | Cmd+B |
| | Italic | Cmd+I |
| | Underline | Cmd+U |
| | Strikethrough | Cmd+Shift+S |
| | Code | Cmd+E |
| | Link | Cmd+K |
| Color | Color/Background picker | Cmd+Shift+H |
| Mention | @ | @ |
| Comment | Comment button | Cmd+Shift+M |
| AI (placeholder) | "Ask AI" | |
| Menu | Three dots: more options (clear formatting, copy as markdown) | |

- Tooltip on each item shows name + shortcut.
- Items with current state apply highlight (e.g. Bold on if entire selection is bold).

## Link UI

- Click Link → small popover with URL input + "Add" + "Open" + "Remove".
- Cmd+K toggles.
- Auto-detect linking when pasting a URL over a selection.

## Color picker

- Two columns (Text / Background) of the 10 colors.
- Click applies; current selection's color shown ticked.

## Block transform

- Selection within a single block → transforms the block.
- Selection across multiple blocks → all blocks transform.

## Comment

- Opens an inline comment thread anchored to the selection's range.

## Behaviour edge cases

- Inside a code block, the formatting toolbar shows only **Comment** (no rich formatting).
- Inside a header, code annotation is allowed.
- Caret-only (no selection): toolbar hidden.

## Tests

- Unit: position calculator (clamped to viewport).
- Playwright: select text, click bold, verify annotation written to Y.Text + API.
- Visual: toolbar open with single-line selection, multi-line selection, near viewport edges.