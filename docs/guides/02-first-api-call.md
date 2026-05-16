# Your first API call

Assuming you've done the [Quickstart](./01-quickstart.md) and have `BLOC_TOKEN` set.

## 1. Sanity check

```bash
curl -H "Authorization: Bearer $BLOC_TOKEN" \
     -H "Notion-Version: 2025-09-03" \
     http://localhost:3001/v1/users/me
```

You should see your user.

## 2. Create a page

```bash
curl -X POST http://localhost:3001/v1/pages \
  -H "Authorization: Bearer $BLOC_TOKEN" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{
    "parent": { "workspace": true },
    "properties": { "title": { "title": [{ "text": { "content": "Hello, Bloc" } }] } }
  }'
```

The response is a `PageObject`. Grab the `id` — call it `$PAGE`.

## 3. Append blocks

```bash
curl -X PATCH http://localhost:3001/v1/blocks/$PAGE/children \
  -H "Authorization: Bearer $BLOC_TOKEN" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{
    "children": [
      { "type": "heading_2", "heading_2": { "rich_text": [{ "text": { "content": "First section" } }] } },
      { "type": "paragraph", "paragraph": { "rich_text": [{ "text": { "content": "Welcome to your new page." } }] } }
    ]
  }'
```

Refresh `http://localhost:3000` — the page is there with the blocks.

## 4. Search

```bash
curl -X POST http://localhost:3001/v1/search \
  -H "Authorization: Bearer $BLOC_TOKEN" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{ "query": "Hello" }'
```

Give it a few seconds after creation for the index to catch up.

## 5. The same in TypeScript

```ts
import { Bloc } from '@bloc/sdk';

const bloc = new Bloc({ auth: process.env.BLOC_TOKEN!, baseUrl: 'http://localhost:3001' });

const page = await bloc.pages.create({
  parent: { workspace: true },
  properties: { title: { title: [{ text: { content: 'Hello, Bloc' } }] } },
});

await bloc.blocks.children.append({
  block_id: page.id,
  children: [
    { type: 'heading_2', heading_2: { rich_text: [{ text: { content: 'First section' } }] } },
    { type: 'paragraph', paragraph: { rich_text: [{ text: { content: 'Welcome.' } }] } },
  ],
});

const hits = await bloc.search({ query: 'Hello' });
console.log(hits.results.length, 'results');
```

## Next

- [Building an integration](./03-building-an-integration.md)
- [Webhook receiver](./07-webhook-receiver.md)
- [API reference](../api/README.md)
