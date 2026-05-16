# Block Components

Each block type has its component under `packages/editor/src/blocks/<type>/<Type>Block.tsx`. All blocks share the same wrapper: a top-level `<div role="group" data-block-id data-block-type>` with drag handle and plus button on hover.

## Common visuals

- Block gutter: 96 px on the left (≥ xl), 24 px (≤ md). The drag handle + plus appear inside the gutter offset −24 px from the content.
- Hover surface: parent block row gets `--bg-hover` at 25% intensity on hover.
- Selection: when selected, `--bg-active`.
- Caret: 1.5 px wide, accent color.

## `paragraph`

- Default body type.
- Rendered as `<div>` with `contenteditable="true"` bound to the block's `Y.Text`.
- Placeholder when empty AND focused AND first block: "Press '/' for commands, or start writing...".
- Placeholder when empty AND focused AND not first block: "Type '/' for commands".

## `heading_1` / `heading_2` / `heading_3`

- 40/30/20 px, weights 700/700/600.
- If `is_toggleable`, render a chevron to the left at the same height; clicking toggles children visibility.
- Margin-top: `--space-8` / `--space-6` / `--space-4`.

## `bulleted_list_item`

- Bullet glyph (●), uses `font-size: 18px` at body 16; vertical-aligned to first line.
- Children indent by `--space-6`; nested level uses ○, then ■.

## `numbered_list_item`

- Numbered glyph; numbering computed across consecutive numbered siblings ignoring non-numbered blocks between them (Notion behaviour).
- Children: 1., a., i. across depths.

## `to_do`

- Checkbox at left; click toggles `checked`.
- When `checked`: text gets `text-decoration: line-through` and `color: var(--text-tertiary)`.

## `toggle`

- Chevron at left; click toggles open/closed.
- Empty content placeholder: "Empty toggle. Click or drop blocks inside.".

## `code`

- Container with `--bg-tertiary` background, 6 px radius, padding `--space-3` `--space-4`.
- Top-right: language picker + copy button.
- Caption (optional) rendered below.
- Syntax highlighting via Shiki theme `vitesse-light` / `vitesse-dark`.
- Tab character inserts spaces (configurable per language).
- Wrap toggle in language picker.

## `quote`

- 3-px left border in `--text-tertiary`, padding-left `--space-4`, italic body text.

## `callout`

- Card with `--bg-tertiary` background, 6 px radius, padding `--space-3`.
- Icon at left (32×32) — clickable to open icon picker.
- Color background variants from rich-text palette `_background` colors.

## `divider`

- 1-px horizontal rule, `--border-default`.
- Top + bottom margin `--space-2`.

## `equation`

- Centered KaTeX render in a card; padding `--space-3`.
- Click to edit: opens a popover with LaTeX textarea and live preview.

## `image`

- Native `<img>` lazy-loaded.
- Hover: alignment toolbar (left/center/right/full-width) + caption toggle + replace + comment.
- Drag handles on left/right to resize horizontally.
- Caption shown below when present.

## `video`, `file`, `pdf`

- Same hover toolbar pattern as image.
- `video` uses HTML5 video; `file`/`pdf` render a card with icon, name, size.

## `embed`

- Determines embed kind from URL (Figma, YouTube, Vimeo, Codepen, Loom, Twitter, Replit, Miro, etc.).
- Renders `<iframe sandbox="allow-scripts allow-same-origin">` to the embed provider URL.
- Fallback: bookmark-style card if URL is unsupported.

## `bookmark`

- Card with site favicon (left), title, description, URL (bottom), preview image (right).
- Fetch metadata at create time via worker; render skeleton until ready.

## `link_preview`

- Like bookmark but smaller; auto-resolved when pasting a Linear / GitHub / Slack / Figma link.

## `table_of_contents`

- Auto-generated list of all headings in the page; indented by heading level.
- Clicking scrolls to the heading.

## `breadcrumb`

- Inline render of the page's ancestor chain.
- Updates as the page is moved.

## `column_list` + `column`

- Flex container; columns flow horizontally.
- Each column: drop-zone for blocks. Initial: 2 equal columns.
- Resize: drag the gap; columns minimum `--space-12`.
- Children: any block type.

## `synced_block`

- Original: same as a regular toggle/region with a "Synced" badge top-right; opening the badge menu shows where else it's synced.
- Duplicate: read-only by default; a "Edit original" link in the badge menu.
- When the original is edited, all duplicates re-render via the Yjs cross-doc sync (implemented as a shared sub-document).

## `table`

- Container with `display: grid`; columns of equal width by default.
- Top row: header toggle option (if `has_column_header`).
- First column: optional row header.
- Plus buttons appear on right edge (add column) and bottom edge (add row) when hovering inside.
- Cell content: rich text inline editor scoped to a `Y.Text` cell.

## `child_page` / `child_database`

- Render as a row with the icon and title; click navigates to the page/database.
- Hover: secondary "Open in side peek" icon (deferred to a later phase).

## `link_to_page`

- Same visual as `child_page` but with a link arrow icon to distinguish from a true child.

## `template`

- Greyed wrapper around its child block subtree; a "Click to add" tag at the top-right.
- Clicking duplicates the subtree as a sibling block.

## `unsupported`

- Greyed-out placeholder card with text "This block type is not supported in the current API version."

## Tests

- Unit per block type: rendering, props, interactions.
- Visual snapshot per block type: empty, with content, hovered, selected, drag-preview.
- Playwright: insert each block via slash menu, type content, verify persistence via API call.