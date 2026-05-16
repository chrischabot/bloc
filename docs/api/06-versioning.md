# Versioning

The public REST surface follows Notion's date-based versioning scheme.

## The header

Every request must carry:

```
Notion-Version: 2025-09-03
```

Bloc supports the four most recent versions Notion has published. Requests with an older version are silently coerced forward to the latest. Requests with an unrecognised version return:

```json
{ "code": "unsupported_version", "status": 400, ... }
```

## What changes between versions

Same things Notion changes: field renames, new enum values, deprecations. The body shape on the wire is what versions arbitrate.

The Bloc SDK pins to a known-good version at module load via `LATEST_VERSION` from `@bloc/shared`. Pass `notionVersion` to the constructor to override:

```ts
const bloc = new Bloc({
  auth: process.env.BLOC_TOKEN,
  baseUrl,
  notionVersion: '2025-09-03',
});
```

Or per-call via the lower-level `client.request({ notionVersion: '…', … })`.

## When you should bump

- When a new field you need lands in a newer version. (Bloc's response includes new fields when you ask for the new version.)
- When the official `@notionhq/client` you're using bumps its version. The SDK sends whatever it's pinned to; mismatched versions are coerced, but you may see fields you didn't expect.

## Bloc internal version

Bloc itself has a server version exposed at `GET /health`:

```json
{ "object": "health", "status": "ok", "version": "2025-09-03", "ts": "..." }
```

The `version` is the same as the `Notion-Version` Bloc advertises by default — not the Bloc server semver, which is in the `X-Bloc-Server` response header.
