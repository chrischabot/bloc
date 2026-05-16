# `bloc.blocks`

REST mapping: [`/v1/blocks`](../api/endpoints/blocks.md).

## Types

```ts
interface BlockObject {
  object:           'block';
  id:               string;
  type:             string;
  has_children:     boolean;
  archived:         boolean;
  in_trash:         boolean;
  parent:           Record<string, unknown>;
  created_time:     string;
  last_edited_time: string;
  created_by:       { object: 'user'; id: string };
  last_edited_by:   { object: 'user'; id: string };
  [key: string]:    unknown;   // the [type] key
}

interface BlockListResponse {
  object:      'list';
  type:        'block';
  results:     BlockObject[];
  next_cursor: string | null;
  has_more:    boolean;
}
```

## `bloc.blocks.retrieve(args) → Promise<BlockObject>`

```ts
args: { block_id: string }
```

## `bloc.blocks.update(args) → Promise<BlockObject>`

```ts
args: { block_id: string } & Record<string, unknown>
```

Pass the type-specific payload directly:

```ts
await bloc.blocks.update({
  block_id,
  paragraph: { rich_text: [{ text: { content: 'New text' } }] }
});
```

## `bloc.blocks.delete(args) → Promise<BlockObject>`

```ts
args: { block_id: string }
```

Soft-archives.

## `bloc.blocks.children.list(args) → Promise<BlockListResponse>`

```ts
args: { block_id: string; start_cursor?: string; page_size?: number }
```

Maps to `GET /v1/blocks/{block_id}/children`.

## `bloc.blocks.children.append(args) → Promise<BlockListResponse>`

```ts
args: {
  block_id: string;
  children: Array<{ type: string; [key: string]: unknown }>;
  after?:   string;
}
```

Inserts children. If `after` is set, inserts directly after that sibling; else appends.

## Examples

### Walk a block tree

```ts
async function walk(blockId: string): Promise<BlockObject[]> {
  const out: BlockObject[] = [];
  let cursor: string | undefined;
  do {
    const page = await bloc.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });
    out.push(...page.results);
    cursor = page.has_more ? page.next_cursor! : undefined;
  } while (cursor !== undefined);
  for (const b of [...out]) {
    if (b.has_children) out.push(...(await walk(b.id)));
  }
  return out;
}
```

### Append a heading + paragraph

```ts
await bloc.blocks.children.append({
  block_id: pageId,
  children: [
    { type: 'heading_2', heading_2: { rich_text: [{ text: { content: 'Plan' } }] } },
    { type: 'paragraph', paragraph: { rich_text: [{ text: { content: 'First draft.' } }] } },
  ]
});
```
