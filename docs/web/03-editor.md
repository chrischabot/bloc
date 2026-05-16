# Editor

The block editor is the central surface. Every page is a tree of blocks.

## Inserting blocks

| Method | What |
|---|---|
| Type `/` | Opens the slash menu — pick any block type |
| Type at a blank line | Creates a paragraph |
| `# `, `## `, `### ` | Headings 1/2/3 |
| `* `, `- ` | Bulleted list |
| `1. ` | Numbered list |
| `[]` (then space) | To-do |
| `>` | Toggle |
| `"` | Quote |
| ` ``` ` (three backticks) | Code block — followed by language id |
| `---` | Divider |
| Paste a URL | Link preview / bookmark / embed (asks) |
| Drag a file in | Image / file / video block |

## Editing rich text

| Combo | What |
|---|---|
| ⌘B / Ctrl+B | Bold |
| ⌘I / Ctrl+I | Italic |
| ⌘U / Ctrl+U | Underline |
| ⌘⇧X / Ctrl+Shift+X | Strikethrough |
| ⌘E / Ctrl+E | Inline code |
| ⌘K / Ctrl+K | Add link |
| ⌘⇧H / Ctrl+Shift+H | Highlight (color) |

Select text → floating formatting toolbar appears with the same options plus color, mention, and AI rewrite.

## Block menu (drag handle)

Hover left of a block → `⋮⋮` handle. Click → menu:

- Turn into…
- Duplicate
- Move to…
- Copy link to block
- Delete (⌫)
- Comment
- Color
- Convert to (page / database row)
- AI → rewrite, summarise, translate

You can also drag the handle to move the block anywhere.

## Mentions

Type `@` to mention a user, page, or date:

- `@alice` — user mention.
- `@Tasks` — page or database mention (typeahead).
- `@today`, `@yesterday`, `@Mar 12` — date mention.

## Slash menu

Type `/` then a search term. Categories:

- Basic — paragraph, headings, list, toggle, callout, quote, divider, …
- Media — image, video, audio, file, bookmark, embed
- Database — inline table, board, list, gallery, calendar, timeline
- AI — AI block, Writer
- Advanced — TOC, breadcrumb, link to page, synced block, button, chart, form

## Block selection

- **Click and drag** in the gutter to select multiple blocks.
- Selected blocks share annotation actions (color, comment, delete).
- ⌘A / Ctrl+A selects everything inside the current block; press again to expand to all blocks on the page.

## Undo / redo

⌘Z / Ctrl+Z and ⌘⇧Z / Ctrl+Shift+Z. Undo is per-page and survives page navigation within a session. Realtime ops from other users are not in your undo stack — undo restores your edit and leaves theirs.

## Drag, drop, paste

- Drag a block over another to nest (sub-block) or place above/below.
- Drag a block to the side of another to start a column layout.
- Paste rich content (HTML from a browser, markdown, an image) → Bloc converts. Markdown shortcuts (`**bold**`, etc.) are recognised on paste.
