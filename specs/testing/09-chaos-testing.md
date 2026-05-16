# Chaos Testing

## Goal

For every endpoint and every code path, ensure malformed / oversized / adversarial inputs do not crash the system; instead they return clean 4xx responses with structured logs.

## Tool

Custom harness in `tests/chaos/`:

- `fast-check` for property-based fuzzing.
- A deterministic adversarial corpus for known attack vectors.

## Adversarial corpus

`tests/chaos/corpora/` contains:

| Corpus file | Content |
|-------------|---------|
| `oversize.json` | strings of length 10k, 100k, 10M; arrays of 1k, 10k items |
| `bad-utf8.bin` | invalid UTF-8 sequences |
| `nullbytes.txt` | strings with embedded `\x00` |
| `crlf.txt` | header / log-line injection strings |
| `unicode-edge.txt` | combining marks, RTL embeds, BOM, ZWJ sequences |
| `sqli.txt` | classic SQL injection patterns |
| `xss.txt` | HTML / JS strings (asserted to be safely rendered) |
| `path-traversal.txt` | `..`, encoded variants, Windows separators |
| `ssrf.txt` | internal IPs (127.0.0.1, 169.254.169.254, [::1]), file://, gopher://, etc. |
| `json-bombs/` | deeply nested objects (1000 levels), wide arrays (1M items) |
| `cursor-evil.txt` | malformed base64, off-by-one cursors, ancient cursors |

## Property tests

Examples in `tests/chaos/properties/`:

- For any random rich-text payload that does not match the schema, the API returns 400 with `details.path` set, and emits a `validation_error` log line.
- For any random integer in `page_size`, the API returns 400 if outside `[1,100]`, else valid.
- For any random parent/child pairing, the API returns 422 if the pairing is not allowed by the block-type table.
- For any random concurrent two-tab edit sequence on the same Y.Doc, the documents converge.

## Crash-attempt vectors

- Submit a `PATCH /blocks/:id/children` with 100k children — assert 400 and no memory blow-up.
- Submit `POST /databases/:id/query` with `or` of 1000 conditions — assert 400.
- Send a malformed WebSocket frame — assert connection closed cleanly with code 1008.
- Send 1M auth attempts in 1 second — assert rate-limiter clamps and no error in logs except the expected rate-limit warns.

## Observability assertions on chaos paths

Every chaos test asserts:

- Response status is documented (no 5xx leak).
- Response body matches the error envelope (Zod-validated).
- A log line at `warn` or `error` was emitted with `code` matching the response.
- A span was created (so the request is observable in production).

## Command

```
pnpm test:chaos             # full
pnpm test:chaos -- --smoke  # quick corpus sample for CI gate on every PR
```