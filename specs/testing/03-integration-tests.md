# Integration Tests

## Tool

Vitest with `setupFiles` that:

1. Boot docker-compose (or expect it running locally).
2. Run migrations.
3. Truncate all tables before each test.
4. Start the API server on an ephemeral port.

## Real services

| Service | Why |
|---------|-----|
| Postgres | System of record |
| Redis | Caching + rate limit |
| MeiliSearch | Search assertions |
| MinIO | File upload signed URL flow |
| Mailpit | Email sends |

Outbound real third-party services (Google OAuth, real S3) are stubbed via `undici.MockAgent`.

## File layout

```
tests/integration/
├── blocks/
│   ├── retrieve.test.ts
│   ├── children.test.ts
│   └── ...
├── pages/
├── databases/
├── search/
├── auth/
├── helpers/
│   ├── client.ts        // built on our SDK
│   ├── factories.ts     // workspace, user, page, block factories
│   ├── tx.ts            // transaction wrappers
│   └── server.ts        // boot/teardown
```

## Helpers

- `withWorkspace(fn)` — spins up a workspace + a user + a bearer token; passes them to `fn`.
- `createPage(client, { children })` — sugar wrapper.
- `assertList(response, expected)` — semantic assertion for `{ object: 'list', results: [...] }`.

## Conventions

- Each test creates its own fixtures; do not share state.
- Assert observable state, not internal SQL.
- Use the SDK to drive the API (dogfood our own SDK).

## Example

```ts
it('append children returns the new blocks in order', async () => {
  await withWorkspace(async ({ client, page }) => {
    const { results } = await client.blocks.children.append({
      block_id: page.id,
      children: [
        { type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: 'A' } }] } },
        { type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: 'B' } }] } },
      ],
    });
    expect(results.map((b) => b.paragraph.rich_text[0].plain_text)).toEqual(['A', 'B']);
  });
});
```