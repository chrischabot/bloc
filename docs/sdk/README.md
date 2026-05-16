# `@bloc/sdk`

First-party TypeScript SDK for Bloc. Exposes every `/v1/*` and `/api/v3/*` endpoint as a typed method.

```bash
pnpm add @bloc/sdk
```

## Quick start

```ts
import { Bloc } from '@bloc/sdk';

const bloc = new Bloc({
  auth: process.env.BLOC_TOKEN!,
  baseUrl: 'http://localhost:3001',
});

const me   = await bloc.users.me();
const page = await bloc.pages.create({
  parent: { workspace: true },
  properties: { title: { title: [{ text: { content: 'Hi' } }] } },
});
const hits = await bloc.search({ query: 'Hi' });
```

## Reference

1. [Client construction](./01-client.md) — options, retries, timeouts
2. [Errors](./02-errors.md) — typed exceptions
3. [Constants](./03-constants.md) — defaults & magic numbers
4. [`bloc.pages`](./04-pages.md)
5. [`bloc.blocks`](./05-blocks.md)
6. [`bloc.databases`](./06-databases.md)
7. [`bloc.dataSources`](./07-data-sources.md)
8. [`bloc.users`](./08-users.md)
9. [`bloc.comments`](./09-comments.md)
10. [`bloc.search`](./10-search.md)
11. [`bloc.webhooks`](./11-webhooks.md)
12. [`bloc.automations` / `bloc.buttons`](./12-automations.md)
13. [`bloc.charts`](./13-charts.md)
14. [`bloc.inbox`](./14-inbox.md)
15. [`bloc.ai`](./15-ai.md)
16. [`bloc.reminders`](./16-reminders.md)
17. [`bloc.analytics`](./17-analytics.md)
18. [`bloc.versions`](./18-versions.md)
19. [`bloc.permissions`](./19-permissions.md)
20. [`bloc.v3`](./20-v3.md)

## Compatibility with `@notionhq/client`

The public `/v1/*` surface is wire-compatible with Notion's. The official client works too:

```ts
import { Client } from '@notionhq/client';

const notion = new Client({ auth: token, baseUrl: 'http://localhost:3001' });
await notion.pages.create({ /* … */ });
```

Use `@bloc/sdk` when you want the Bloc-specific surfaces (AI, charts, reminders, automations, forms, sites, audit, analytics, internal v3, etc.). Use `@notionhq/client` when you specifically need Notion API compatibility (e.g. shared code that targets either).
