# Rendering with `react-notion-x`

Bloc's `/api/v3/*` endpoints emit a `recordMap` shape that `<NotionRenderer/>` from [`react-notion-x`](https://github.com/NotionX/react-notion-x) renders directly.

## Why this exists

Two reasons:

1. You have an existing `<NotionRenderer/>` deployment fed from Notion's internal API and want to swap it to Bloc.
2. You want to render Bloc pages in another React app with minimal code.

## Install

```bash
pnpm add @bloc/sdk react-notion-x
```

## Render a page

```tsx
import { Bloc } from '@bloc/sdk';
import { NotionRenderer } from 'react-notion-x';
import 'react-notion-x/src/styles.css';
import 'prismjs/themes/prism-tomorrow.css';  // for code highlighting

const bloc = new Bloc({ auth, baseUrl });

export async function Page({ pageId }: { pageId: string }) {
  // Load all chunks until cursor.stack is empty.
  const chunks: Array<{ recordMap: any; cursor: { stack: any[] } }> = [];
  let stack: any[] = [];
  do {
    const chunk = await bloc.v3.loadPageChunk({
      pageId,
      limit: 100,
      chunkNumber: chunks.length,
    });
    chunks.push(chunk);
    stack = chunk.cursor.stack;
  } while (stack.length > 0);

  // Merge recordMaps.
  const recordMap = mergeRecordMaps(chunks.map(c => c.recordMap));

  return <NotionRenderer recordMap={recordMap} fullPage darkMode={false} />;
}

function mergeRecordMaps(maps: any[]): any {
  return maps.reduce((acc, m) => {
    for (const table of Object.keys(m)) {
      acc[table] = { ...(acc[table] ?? {}), ...m[table] };
    }
    return acc;
  }, {});
}
```

## What gets rendered

The Bloc serialiser populates these tables:

- `block` — every block on the page, with `value.id`, `value.type`, `value.properties`, `value.format`, `value.parent_id`.
- `space` — the workspace.
- `collection` + `collection_view` — for child databases.
- `notion_user` — for author bubbles.
- `discussion` + `comment` — comments inline.

If a block requires a related record that's not in the map, `<NotionRenderer/>` shows a loading placeholder. Bloc always emits the related records on `loadPageChunk` — if you're seeing placeholders, that's likely a bug; file an issue.

## Comments, embeds, code

Most blocks render out of the box. A few have config knobs:

```tsx
<NotionRenderer
  recordMap={recordMap}
  fullPage
  darkMode={false}
  components={{
    Code:     ({ block, defaultLanguage }) => <Code {...} />,
    Equation: ({ block, math }) => <KaTeX>{math}</KaTeX>,
    Tweet:    ({ id }) => <Tweet id={id} />,
    PageLink: ({ href, children }) => <Link href={href}>{children}</Link>,
  }}
/>
```

## Updating

When `react-notion-x` ships a new version, run the contract tests against your Bloc server:

```bash
pnpm --filter bloc-api run test:contract:v3
```

If they pass, you're safe to upgrade. If not, the Bloc serializer needs an update to match — please open an issue or a PR.

## Performance

`loadPageChunk` is paginated; the renderer can mount with a partial recordMap and re-mount when more chunks arrive. For large pages, render the first chunk eagerly and load subsequent chunks in the background.

`syncRecordValues` lets you incrementally update changes; use it for live-updating renderers. The Bloc web app uses the WebSocket instead — `syncRecordValues` is mostly for read-only embeds.
