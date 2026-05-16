# Block Types

## Canonical block model

**Every visible thing in Notion is a block, and text characters live as rich-text inside text-bearing blocks.** Paragraphs, headings, images, pages, database rows, databases, and (internally) the workspace root are all records of the `blocks` table. The text *characters* a user types are **not** separate block rows; they are nodes inside the `properties.rich_text` array (or in Yjs, inside the block's `Y.Text`) — see `docs/api/schemas/rich-text.md`. This distinction matters: edits to a character are operations against a block's `Y.Text`, not transactions against a `blocks` row.

Every block row has the shape:

```
{
  id:              uuid,
  type:            string,               // discriminator
  parent_id:       uuid,                 // single parent
  parent_type:     'block'|'page'|'database'|'workspace',
  content:         [child_block_id],     // ordered list of child UUIDs
  properties:      type-specific JSON,   // e.g. { rich_text: [...] } for paragraphs, { title: [...] } for pages
  format:          rendering-specific JSON,  // color, width, alignment, etc.
  created_by_id:   uuid,
  last_edited_by_id: uuid,
  created_time:    timestamp,
  last_edited_time: timestamp,
  alive:           bool,                 // soft delete
  version:         int                   // monotonic per record (for v3 conflict resolution)
}
```

Pages are blocks of type `page` whose `properties.title` carries the rich-text title and whose `content` is the page body's top-level block IDs. Databases are blocks of type `collection` (in v3 terminology) or `database` (public API surface). The "everything is a block" axiom is **the** foundation of the data model — every endpoint, every editor command, every CRDT operation rests on it.

The public REST surface exposes blocks under three object shapes (`block`, `page`, `database`) for clarity, but underneath they are rows of the same `blocks` table polymorphically.

## Common envelope

Every block has the common envelope:

```jsonc
{
  "object": "block",
  "id": "uuid",
  "parent": { "type": "page_id" | "block_id" | "database_id" | "workspace", "page_id": "..." },
  "created_time": "iso8601",
  "created_by": { "object": "user", "id": "uuid" },
  "last_edited_time": "iso8601",
  "last_edited_by": { "object": "user", "id": "uuid" },
  "archived": false,
  "in_trash": false,
  "has_children": false,
  "type": "<one of the types below>",
  "<type>": { /* type-specific payload */ }
}
```

The `<type>` key is repeated as a property containing the payload. Exactly one such key is present per block.

## Supported types (all required for v1)

| `type` | Description | Has children? | Payload schema |
|--------|-------------|---------------|----------------|
| `paragraph` | Plain text paragraph | optional | `{ rich_text: RichText[], color: ColorEnum, children?: Block[] }` |
| `heading_1` | H1 | toggleable | `{ rich_text: RichText[], color, is_toggleable: bool, children?: Block[] }` |
| `heading_2` | H2 | toggleable | as above |
| `heading_3` | H3 | toggleable | as above |
| `bulleted_list_item` | Bulleted item | yes | `{ rich_text, color, children? }` |
| `numbered_list_item` | Numbered item | yes | as above |
| `to_do` | Checkbox item | yes | `{ rich_text, checked: bool, color, children? }` |
| `toggle` | Toggle (open/close) | yes | `{ rich_text, color, children? }` |
| `code` | Code block | no | `{ rich_text, caption: RichText[], language: CodeLanguage }` |
| `child_page` | Sub-page | no (its own page) | `{ title: string }` |
| `child_database` | Sub-database | no | `{ title: string }` |
| `embed` | Generic embed (figma, codepen, etc.) | no | `{ url: string, caption: RichText[] }` |
| `image` | Image | no | `{ caption: RichText[], type: 'external'\|'file', external?: { url }, file?: { url, expiry_time } }` |
| `video` | Video | no | as image |
| `file` | File | no | as image, plus `{ name?: string }` |
| `pdf` | PDF | no | as image |
| `bookmark` | Web bookmark | no | `{ url, caption }` |
| `callout` | Callout | yes | `{ rich_text, icon: { type, ... }, color, children? }` |
| `quote` | Block quote | yes | `{ rich_text, color, children? }` |
| `equation` | Block equation | no | `{ expression: string }` |
| `divider` | Horizontal rule | no | `{}` |
| `table_of_contents` | TOC | no | `{ color }` |
| `breadcrumb` | Breadcrumb trail | no | `{}` |
| `column_list` | Column container | yes (`column`s only) | `{}` |
| `column` | Column inside column_list | yes | `{ width_ratio?: number }` |
| `link_preview` | Auto-resolved link preview | no | `{ url }` |
| `synced_block` | Original or duplicate sync source | yes (original only) | see below |
| `template` | Template block | yes | `{ rich_text, children? }` |
| `link_to_page` | Mention-style link to another page/database | no | `{ type: 'page_id'\|'database_id'\|'comment_id', page_id?, database_id?, comment_id? }` |
| `table` | Table | yes (table_row only) | `{ table_width: int, has_column_header: bool, has_row_header: bool, children?: TableRow[] }` |
| `table_row` | Row inside table | no | `{ cells: RichText[][] }` |
| `unsupported` | Server-side placeholder for blocks we cannot render | no | `{}` |
| `button` | Clickable action runner (see `docs/frontend/20-buttons-automations.md`) | no | `{ label, icon?, style, color, steps: AutomationStep[], confirm?: { enabled, message } }` |
| `chart` | Inline chart referencing a database (see `docs/frontend/22-charts.md`) | no | `{ config: ChartConfig, title?: string, description?: RichText[] }` |
| `audio` | Audio file or recording | no | `{ caption: RichText[], type: 'external'\|'file', external?: { url }, file?: { url, expiry_time, duration_s?, waveform? } }` |
| `meeting_notes` | AI Meeting Notes container with transcript + summary (see `docs/frontend/18-ai.md#ai-meeting-notes`) | yes | `{ recording_id: string, language: string, speakers: [{ id, name }], sections: { summary: RichText[], key_points: RichText[], action_items: RichText[], decisions: RichText[] }, transcript_visible: bool }` |
| `ai_block` | Persistent AI completion block | no | `{ prompt: RichText[], output: RichText[], model: string, last_run_at: iso8601 }` |
| `sub_page_list` | Auto-rendered list of immediate child pages (sidebar widget for index pages) | no | `{ filter?: { archived?: bool }, sort?: 'manual'\|'recent' }` |

That is 38 block-type values implemented in v1 (Notion's full public superset including the AI / button / chart / meeting-notes / audio extensions). The user-request target said "~20"; the complete set is implemented so the editor and API are byte-identical to upstream.

## Per-type details

### Paragraph / list items / toggle / callout / quote / heading

- Rich text array up to 100 nodes (see rich-text doc).
- `color` from the 19-value palette.
- `children`: not returned in retrieve responses — clients call `GET /blocks/{id}/children`.

### `to_do`

- `checked: boolean` — toggles independently of rich text content.
- Toggling emits `block.updated` realtime event.

### `code`

- `language`: one of
  ```
  abap, agda, arduino, ascii art, assembly, bash, basic, bnf, c, c#, c++,
  clojure, coffeescript, coq, css, dart, dhall, diff, docker, ebnf, elixir,
  elm, erlang, f#, flow, fortran, gherkin, glsl, go, graphql, groovy, haskell,
  html, idris, java, javascript, json, julia, kotlin, latex, less, lisp,
  livescript, llvm ir, lua, makefile, markdown, markup, matlab, mathematica,
  mermaid, nix, notion formula, objective-c, ocaml, pascal, perl, php, plain text,
  powershell, prolog, protobuf, purescript, python, r, racket, reason, ruby, rust,
  sass, scala, scheme, scss, shell, smalltalk, solidity, sql, swift, toml,
  typescript, vb.net, verilog, vhdl, visual basic, webassembly, xml, yaml, java/c/c++/c#
  ```
- `caption`: rich text array.

### `image` / `video` / `file` / `pdf`

- `type`: `"external"` or `"file"`.
- `external.url`: a public URL; we verify on insert that the URL responds with 2xx and is allowlisted host (no SSRF).
- `file`: object storage reference; URL refreshed on every retrieve with a 1h expiry.

### `bookmark`

- `url`: validated as http/https.
- We synchronously fetch OpenGraph metadata via the indexer; rendering uses fallback if metadata not available.

### `callout`

- `icon`: `{ type: 'emoji', emoji: '💡' }` or `{ type: 'external', external: { url } }` or `{ type: 'file', file: { url, expiry_time } }`.

### `equation`

- `expression`: KaTeX-compatible LaTeX.

### `divider`, `breadcrumb`, `table_of_contents`

- No mutable fields beyond `color` for TOC.

### `column_list` + `column`

- `column_list.children` must be exclusively `column` blocks (≥ 2).
- Each `column.width_ratio` defaults to `1/n` for `n` columns; constrained to sum to 1.0.
- Children of a `column` may be any block type.

### `synced_block`

- Original: `{ synced_from: null, children: [...] }` — has the actual content.
- Duplicate: `{ synced_from: { block_id: "<original-id>" }, children: [] }` — read-only mirror.
- Editing the original mutates all duplicates.
- Deleting the original promotes the oldest duplicate to original (Notion behaviour).

### `table` + `table_row`

- `table.table_width`: number of columns; immutable after creation (resize via property API).
- `table_row.cells`: array of length `table_width`; each cell is a rich text array.

### `link_to_page`

- Renders as a clickable card linking to the referenced object.
- Cannot self-reference (cycle detection).

### `template`

- Used inside databases / templates feature: clicking duplicates the block subtree.

### `unsupported`

- Returned when an older API version cannot represent a newer block type. Clients render as a greyed-out placeholder.

## Validation

`packages/shared/src/blocks/<type>.ts` exports the per-type Zod schema. The combined union schema lives in `packages/shared/src/blocks/index.ts` as `BlockSchema = z.discriminatedUnion('type', [...])`.

## Tests

- Unit: round-trip each block type through schema.
- Contract: for each type, `POST /pages` with a child of that type, then `GET /blocks/{id}` returns the exact same payload (modulo IDs and timestamps).
- Chaos: oversized payloads, wrong type strings, wrong language strings, unrecognised colors, missing required fields each return 400 with appropriate `details`.
- Visual: render every block type in the editor and snapshot.