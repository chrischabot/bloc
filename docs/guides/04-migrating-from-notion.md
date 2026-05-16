# Migrating from Notion

You have two main options: **export from Notion + import to Bloc**, or **continue using `@notionhq/client` against Bloc** for code paths and copy your own data over time.

## Option A: bulk import via Notion's export

1. In Notion, **Settings → Settings → Export all workspace content** → choose **Markdown & CSV** or **HTML**.
2. Wait for the email with the `.zip`.
3. In Bloc, **Settings → Imports → Notion** → upload the `.zip`.
4. Bloc unpacks the directory tree, creates pages mirroring the structure, converts blocks where the mapping is unambiguous, and reports a summary of what couldn't be converted exactly (custom embeds, sub-pages with circular links, etc.).

Caveats:

- Database property types translate 1:1.
- Inline databases become inline databases.
- Files/images convert by re-uploading from the `.zip`.
- Comments are not preserved in the Notion export and therefore not imported.
- Version history is not exported by Notion and starts fresh in Bloc.

## Option B: keep using `@notionhq/client`, switch baseUrl

The fastest way to move workloads:

```ts
import { Client } from '@notionhq/client';

const notion = new Client({
  auth: process.env.BLOC_TOKEN,
  baseUrl: 'https://your-bloc',
});

await notion.pages.create({ /* unchanged */ });
```

Everything the official SDK does works against Bloc. If your code already uses the official SDK, this is a one-line change.

## Option C: dual-write during migration

Until you trust Bloc, keep writing to both:

```ts
const notion = new Client({ auth: notionToken });
const bloc   = new Client({ auth: blocToken, baseUrl: BLOC });

async function createPage(args) {
  const [n, b] = await Promise.allSettled([notion.pages.create(args), bloc.pages.create(args)]);
  // log divergence; decide which side wins on conflict.
}
```

After a confidence period, flip reads to Bloc, then writes.

## ID mapping

Notion's UUIDs are *not* preserved on import — Bloc assigns its own. If you have external references (Linear issues mentioning a Notion page id), maintain a mapping table:

| notion_page_id | bloc_page_id |
|---|---|
| ... | ... |

Bloc's import endpoint can produce a mapping CSV — call `GET /v1/imports/{id}/mapping` after the import completes.

## API differences that matter

Bloc is wire-compatible but extends the surface:

- New resources: AI, charts, automations, forms, reminders, sites, audit, analytics, internal v3, data sources.
- `pages.delete` accepts `?permanent=true` (Notion's doesn't).
- The error envelope includes `details` on `validation_error`; Notion's does too as of 2024-04, but the format is identical.

## What you lose

- Notion AI's retrieval quality. Bloc's AI surface is shape-compatible; answer quality depends on your LLM.
- Some embeds that depend on Notion's embed proxy. Bloc renders embeds via oEmbed where possible; failing that, you see a fallback link.
- Notion's mobile apps. Bloc's mobile is web-based and responsive.

## When in doubt

- Run the import twice with a small workspace first. Compare the page tree and a few representative pages by eye.
- Wire your CI to run `tests/sdk-progressive/` against your Bloc server.
- Keep the Notion `.zip` until you've been on Bloc for a couple of months.
