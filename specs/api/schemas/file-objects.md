# File Objects

Two shapes for file references in payloads.

## External

```jsonc
{ "type": "external", "external": { "url": "https://..." } }
```

- `url`: must be `http`/`https`; SSRF allowlist applied.

## File (object storage)

```jsonc
{ "type": "file", "file": { "url": "https://signed...", "expiry_time": "2026-05-15T20:15:00Z" } }
```

- `url`: a pre-signed S3 URL valid for 1 hour.
- `expiry_time`: matches the URL expiry.
- Re-issued on every retrieve.

## Upload flow

1. `POST /v1/files` `{ name, mime, size_bytes }` → `{ id, upload_url, expiry_time }`.
2. Client `PUT`s bytes directly to `upload_url`.
3. Client passes `{ type: 'file', file: { id } }` when attaching to a block / property.
4. Server resolves `id` → signed URL on retrieve.

## Image extensions

When a file is an image (`mime` starts with `image/`), API responses additionally include `caption` (rich text array) and `alt_text` (string) where applicable to the embedding block.

## Tests

- Round-trip both shapes through schema.
- Chaos: non-http(s) URLs, file://, javascript:, data:, internal hostnames (169.254.169.254, 127.0.0.1, etc.) all rejected.