# Block types

Bloc supports 38 block types. Each block has the common envelope (`object`, `id`, `type`, `parent`, `has_children`, `archived`, `in_trash`, `created_time`, `last_edited_time`, `created_by`, `last_edited_by`) plus a type-specific key matching the `type` value.

| `type` | Payload key | Notes |
|---|---|---|
| `paragraph` | `paragraph: { rich_text, color, children? }` | Default text block |
| `heading_1` | `heading_1: { rich_text, color, is_toggleable, children? }` | H1 |
| `heading_2` | `heading_2: { … }` | H2 |
| `heading_3` | `heading_3: { … }` | H3 |
| `bulleted_list_item` | `bulleted_list_item: { rich_text, color, children? }` | |
| `numbered_list_item` | `numbered_list_item: { rich_text, color, children? }` | |
| `to_do` | `to_do: { rich_text, checked, color, children? }` | |
| `toggle` | `toggle: { rich_text, color, children? }` | |
| `quote` | `quote: { rich_text, color, children? }` | |
| `callout` | `callout: { rich_text, color, icon, children? }` | |
| `code` | `code: { rich_text, caption, language }` | `language` is the syntax id |
| `equation` | `equation: { expression }` | KaTeX |
| `divider` | `divider: {}` | |
| `table_of_contents` | `table_of_contents: { color }` | Auto-generated TOC |
| `breadcrumb` | `breadcrumb: {}` | |
| `image` | `image: { type, caption, file?, external? }` | |
| `video` | `video: { type, caption, file?, external? }` | |
| `audio` | `audio: { type, caption, file?, external? }` | |
| `file` | `file: { type, caption, name, file?, external? }` | |
| `pdf` | `pdf: { type, caption, file?, external? }` | |
| `bookmark` | `bookmark: { url, caption }` | |
| `embed` | `embed: { url, caption }` | |
| `link_preview` | `link_preview: { url }` | |
| `link_to_page` | `link_to_page: { type: "page_id"|"database_id", page_id?, database_id? }` | |
| `synced_block` | `synced_block: { synced_from: { type, block_id }? | null, children? }` | `synced_from: null` = original, else = reference |
| `template` | `template: { rich_text, children? }` | Page-level template block |
| `column_list` | `column_list: { children: column[] }` | |
| `column` | `column: { width_ratio?, children: block[] }` | |
| `table` | `table: { table_width, has_column_header, has_row_header, children: table_row[] }` | |
| `table_row` | `table_row: { cells: rich_text[][] }` | Each cell is a `rich_text[]` |
| `child_page` | `child_page: { title }` | Reference; the actual page is its own resource |
| `child_database` | `child_database: { title }` | Reference |
| `unsupported` | `unsupported: {}` | Server placeholder for unknown types |
| `mention_inline` (rich-text only) | — | Not a block type; appears inside `rich_text` |
| `ai_block` | `ai_block: { surface, prompt, completion: { text, model, ... }? }` | AI-driven content |
| `button` | `button: { label, automation_id }` | Click to invoke an automation |
| `chart` | `chart: { kind, data_source, style }` | Embeds a chart |
| `form` | `form: { form_id, mode: "embed"|"link" }` | Embeds a form view |

## Common annotations on text

Every `rich_text` run carries:

```json
{
  "type": "text" | "mention" | "equation",
  "text":     { "content": "...", "link": { "url": "..." } | null }      // when type == 'text'
  "mention":  { ... }                                                      // when type == 'mention'
  "equation": { "expression": "..." }                                      // when type == 'equation'
  "annotations": {
    "bold": false, "italic": false, "strikethrough": false, "underline": false,
    "code": false, "color": "default" | "..."
  },
  "plain_text": "...",
  "href": "..." | null
}
```

See [Rich text](./rich-text.md) for the full spec.

## File objects

`file` / `external` shapes used by media blocks:

```json
{ "type": "file",     "file":     { "url": "https://signed.url/...", "expiry_time": "..." } }
{ "type": "external", "external": { "url": "https://..." } }
```

`file` URLs are signed and refreshed automatically; expect a TTL ≥ 1 h. Re-fetching the block re-signs.

## Colours

`color` is one of:

`default`, `gray`, `brown`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`, `red`, and each as a `_background` variant (`gray_background`, …).
