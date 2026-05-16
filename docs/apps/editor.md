# Editor

The block editor combines:

- A block tree (38 block types — see [API › Block types](../api/schemas/block-types.md)).
- Rich text with inline mentions, equations, links.
- Real-time collaboration over WebSockets.
- Slash-menu insertion, drag-to-reorder, keyboard-shortcut formatting.

For the end-user shortcuts and UX, see [Web › Editor](../web/03-editor.md). This page covers the model and how to write code against it.

## Block tree

Each block has:

```ts
{
  object: 'block',
  id: 'uuid',
  type: '...',
  parent: { type, id? },
  has_children: boolean,
  archived: boolean,
  in_trash: boolean,
  [type]: { /* payload */ },
  // audit fields
}
```

Children are loaded lazily via `GET /v1/blocks/{id}/children`. Document order on disk matches the natural reading order.

## Inserting via the API

```ts
await bloc.blocks.children.append({
  block_id: pageId,
  children: [
    { type: 'heading_2', heading_2: { rich_text: [{ text: { content: 'Plan' } }] } },
    { type: 'paragraph', paragraph: { rich_text: [{ text: { content: 'Step 1.' } }] } },
    { type: 'to_do',     to_do:     { rich_text: [{ text: { content: 'Do thing' } }], checked: false } },
    { type: 'code',      code:      { language: 'typescript', rich_text: [{ text: { content: 'const x = 1;' } }] } },
  ],
});
```

`after: <sibling_id>` inserts at a specific spot.

## Synced blocks

Two parts to a synced block:

- The **original** (`synced_from: null`) holds the canonical children.
- **References** (`synced_from: { block_id }`) carry no children; they render the original's content live.

Editing a reference edits the original. Deleting a reference doesn't touch the original. Deleting the original breaks all references.

## Columns

A column layout is a `column_list` block with `column` children. Each `column` has `width_ratio` (default `1 / N`) and its own children.

The editor lays them out side-by-side; on narrow viewports they stack.

## Equations

KaTeX. `equation` blocks and inline `equation` mentions accept LaTeX expressions:

```json
{ "type": "equation", "equation": { "expression": "E = mc^2" } }
```

## AI blocks

`ai_block` carries a `surface`, a `prompt`, and (when filled) a `completion: { text, model, ... }`. The editor renders the completion as plain text; calling `POST /v1/ai/completions` with the block id persists the completion back.

## Buttons

`button` blocks carry a `label` and an `automation_id`. Clicking calls `POST /v1/buttons/{block_id}/invoke`. The result appears as a toast next to the button — `success` (green), `partial` (yellow), `failed` (red) with the error message.

## Realtime

Edits propagate via WebSocket; see [Platform › Realtime & sync](../platform/06-realtime-and-sync.md). The editor optimistically applies local edits, journals them in IndexedDB, and reconciles on `ack` / `nack`.
