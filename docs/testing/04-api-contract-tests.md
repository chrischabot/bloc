# API Contract Tests

## Goal

Prove that every API response matches the documented JSON shape exactly. Drift is caught here.

## How

1. `packages/shared` defines a Zod schema per response type.
2. `tools/codegen/json-schema.ts` derives a JSON Schema document from each Zod schema and writes to `tests/contract/schemas/`.
3. Contract tests issue real requests against the live API server and assert:
   - Response status matches.
   - Response body validates against the JSON Schema.
   - Headers include the required ones (`X-Request-Id`, `Notion-Version`).

## Fixtures

`tests/contract/__fixtures__/` stores recorded reference responses (anonymised) for:

- Each block type (a page containing it, then `GET /v1/blocks/{id}`).
- Each property type (a database row with that value, then `GET /v1/pages/{id}`).
- Each filter operator (a small DB seeded with hand-picked rows, then `POST /databases/{id}/query`).

Fixtures are committed; tests assert the fresh response is structurally equal modulo IDs/timestamps.

## Error contract

Every documented error code is exercised:

- 400 invalid_request via missing required field.
- 401 unauthorized via missing bearer.
- 403 / 404 restricted via permission denial.
- 409 conflict via duplicate idempotency key.
- 429 rate_limited by burst.
- 422 unprocessable via cyclic parent.

The error envelope itself is validated by the schema.

## Notion-Version

Every contract test also runs with an unknown `Notion-Version` header and asserts 400 with `code: invalid_request`.

## SDK alignment

For each endpoint, run **both** our SDK and `@notionhq/client` against the same input and assert byte-equality of the response (modulo IDs/timestamps). This is the SDK-progressive bridge (see next doc).