# Bulk imports from CSV

When you have thousands of rows to bring into a Bloc database.

## Option A: built-in importer (small files)

UI: **Settings → Imports → CSV** → upload. Map columns to properties. Pick a target database (or create one). Up to 100k rows, a few minutes.

## Option B: API + chunking (large files / programmatic)

For multi-million-row imports, drive it from your own script.

```ts
import { Bloc } from '@bloc/sdk';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'node:fs';

const bloc = new Bloc({ auth, baseUrl });
const rows = parse(readFileSync('data.csv', 'utf8'), { columns: true });

const databaseId = await ensureDatabase(rows[0]);

const concurrency = 8;
const queue = [...rows];
const workers = Array.from({ length: concurrency }, async () => {
  while (queue.length) {
    const row = queue.shift()!;
    try {
      await bloc.pages.create({
        parent: { database_id: databaseId },
        properties: toProperties(row),
      });
    } catch (e) {
      // Re-enqueue on transient; log on permanent.
      if (isTransient(e)) queue.push(row);
      else console.error('skipped', row, e);
    }
  }
});

await Promise.all(workers);
```

## Tips

- **Rate limit awareness.** The default bucket on `POST /v1/pages` is 30 burst / 3 sustained. With concurrency 8, you'll see 429s under sustained load — the SDK retries, but you can pre-empt by sleeping 100 ms between writes per worker.
- **Idempotency.** Add `idempotency_key: hash(row)` in your write so re-running the script doesn't duplicate rows. Pass it as the `Idempotency-Key` header.
- **Batch property mapping.** Pre-resolve `select` option ids before the loop — `select` properties accept name *or* id; resolving once is cheaper than letting Bloc resolve every write.
- **Files.** If your CSV has file URLs, write the row first as `type: 'external'`, then re-upload via the file upload flow if you want Bloc-hosted copies.
- **Don't fight the index.** Search indexing trails writes; expect the new rows to appear in search a few seconds later.

## Verifying

After the import, count rows:

```ts
let total = 0;
let cursor: string | undefined;
do {
  const page = await bloc.databases.query({ database_id: databaseId, page_size: 100, start_cursor: cursor });
  total += page.results.length;
  cursor = page.has_more ? page.next_cursor! : undefined;
} while (cursor !== undefined);
console.log('Imported rows:', total);
```

Compare to your CSV row count. Diff the mapping if they don't match.

## Resuming

If your script dies halfway, restart it. With idempotency keys set, previously imported rows are skipped server-side and you don't pay double.

## Rollback

Soft-archive everything: query the database, `bloc.pages.delete({ page_id })` for each. To hard-delete, archive first, then call `delete({ page_id, permanent: true })` per row.
