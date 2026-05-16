# Building a custom block

End-to-end pattern for adding a new block type to Bloc.

## What "custom block" means

Bloc's 38 built-in block types are described in [API › Block types](../api/schemas/block-types.md). The data model is open — you can define a new type, store it, serialise it, and render it.

A custom block touches:

1. **Schema** — a Zod definition under `packages/shared/src/blocks/`.
2. **Serializer** — `apps/api/src/serializer.ts` so the API round-trips it.
3. **Validator** — input validation on `POST /v1/blocks/{id}/children`.
4. **Renderer** (web) — a React component under `apps/web/components/blocks/`.
5. **Slash menu entry** so users can insert it.
6. **(Optional)** webhook event types and audit metadata.

## Walkthrough: a `mermaid` diagram block

### 1. Schema

`packages/shared/src/blocks/mermaid.ts`:

```ts
import { z } from 'zod';

export const MermaidBlock = z.object({
  type: z.literal('mermaid'),
  mermaid: z.object({
    expression: z.string().max(10_000),
    caption: z.array(RichText).optional(),
  }),
});
```

Register it in the discriminated union at `packages/shared/src/blocks/index.ts`.

### 2. Migration

If you need a dedicated column (you usually don't — Bloc stores the payload in JSONB):

```sql
-- migrations/0042_mermaid_block.sql
-- Nothing to do for storage; JSONB already covers it.
-- But: add a GIN expression index if you'll query by mermaid.expression.
CREATE INDEX blocks_mermaid_expression_idx
  ON blocks USING gin ((payload -> 'mermaid' -> 'expression'));
```

### 3. Serializer

The API serializer translates the DB row to the wire shape. Most of the time it's automatic — `apps/api/src/serializer.ts` reads the discriminator and emits the payload. If you store anything in a separate column, map it here.

### 4. Validator

The router validates incoming children against the union schema. With step (1) done, this is automatic.

### 5. Renderer

`apps/web/components/blocks/MermaidBlock.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

export function MermaidBlock({ block }: { block: any }) {
  const ref = useRef<HTMLDivElement>(null);
  const expr = block.mermaid.expression;
  useEffect(() => {
    if (!ref.current) return;
    mermaid.render(`m-${block.id}`, expr).then(({ svg }) => {
      ref.current!.innerHTML = svg;
    });
  }, [expr]);
  return <div ref={ref} className="bloc-block-mermaid" />;
}
```

Wire it up in `apps/web/components/Block.tsx`:

```tsx
case 'mermaid': return <MermaidBlock block={block} />;
```

### 6. Slash menu

`apps/web/components/SlashMenu/items.ts`:

```ts
{ id: 'mermaid', name: 'Mermaid diagram', icon: '🧜‍♀️', category: 'Advanced',
  insert: (page) => bloc.blocks.children.append({
    block_id: page.id,
    children: [{ type: 'mermaid', mermaid: { expression: 'graph TD; A-->B;' } }],
  }) }
```

### 7. Versioned render

If your block has shared state (synced blocks, charts) make sure the realtime layer emits an `event` when the payload changes — the default path handles this. If you store derived data, invalidate it on write.

## Testing

- **Unit** — schema accepts valid inputs, rejects invalid. Run with `pnpm --filter shared test`.
- **Contract** — `tests/contract/blocks/mermaid.test.ts` round-trips create → retrieve → update → delete.
- **E2E** — `tests/e2e/blocks/mermaid.spec.ts` adds the block via the slash menu and asserts it renders.

## Publishing

If you want others to use your block, package it under `packages/blocks-mermaid/` with the same files (schema, renderer, slash entry) and let the host install it via `BLOC_PLUGINS=@your/blocks-mermaid`. A small loader at boot wires the schema/renderer into the union.

The plugin loader is intentionally minimal — there's no runtime sandboxing, so plugins are server-trust.
