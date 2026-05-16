# SDK-Progressive Tests

## Goal

For every public function in the **official** `@notionhq/client`, our implementation produces an equivalent response when given equivalent input.

The suite grows monotonically with phases. Each unblock is explicit.

## File layout

```
tests/sdk-progressive/
├── matrix.ts                    // declares which SDK fns are unblocked
├── helpers/
│   ├── ourClient.ts             // built on packages/sdk
│   ├── officialClient.ts        // built on @notionhq/client (with axios baseURL pointing to OUR server)
│   └── compare.ts               // structural equality modulo IDs/timestamps
├── blocks/
│   ├── retrieve.test.ts
│   ├── children.list.test.ts
│   ├── children.append.test.ts
│   ├── update.test.ts
│   └── delete.test.ts
├── pages/
├── databases/
├── search/
├── users/
└── comments/
```

## Matrix file

```ts
// matrix.ts
export const unblocked = {
  // Phase 2
  'blocks.retrieve': true,
  'blocks.children.list': true,
  'blocks.children.append': true,
  'blocks.update': true,
  'blocks.delete': true,
  // Phase 3
  'pages.create': true,
  'pages.retrieve': true,
  'pages.update': true,
  'pages.properties.retrieve': true,
  // Phase 4
  'databases.create': true,
  'databases.retrieve': true,
  'databases.update': true,
  'databases.query': true,
  // Phase 5
  'search': true,
  'users.me': true,
  'users.retrieve': true,
  'users.list': true,
  'comments.create': true,
  'comments.list': true,
};
```

Tests skip themselves automatically (`it.skipIf(!unblocked['fn'])`) so the suite remains green across phases.

## Test pattern

```ts
it('blocks.retrieve returns matching shape', async () => {
  const { page, block } = await seed();

  const ours = await ourClient.blocks.retrieve({ block_id: block.id });
  const official = await officialClient.blocks.retrieve({ block_id: block.id });

  // Both call our server; we test that our SDK produces the same shape as the official one would.
  expect(structuralEqual(ours, official)).toBe(true);
});
```

## Compare helper

`compare.structuralEqual(a, b)`:

- Walks both trees.
- Ignores keys: `id`, `created_time`, `last_edited_time`, `request_id`, `url`, `public_url`, `created_by`, `last_edited_by` (substituted with a placeholder for shape check).
- Ignores numeric timestamps in `expiry_time`.
- Asserts same keys, same types.

## Progressive coverage table

| Phase | SDK fns unblocked | Cumulative |
|-------|-------------------|------------|
| 2 | 5 | 5 |
| 3 | 4 | 9 |
| 4 | 4 | 13 |
| 5 | 5 | 18 |

Final count matches `@notionhq/client`'s public surface.

## Failure mode

If the official SDK is updated and adds a new function, this suite still passes (the new function isn't in our matrix). A separate `discovery.test.ts` lists `@notionhq/client`'s exports and warns when something new appears — opens an issue, doesn't fail.