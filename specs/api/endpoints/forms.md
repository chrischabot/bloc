# Forms Endpoints

See `docs/frontend/21-forms.md`.

Forms are database views with `type=form`. Therefore CRUD on forms uses the existing database-view endpoints with view-type-specific config; submissions have a dedicated route.

## `POST /v1/databases/{database_id}/views`

Standard view-create endpoint with `type=form`:

```jsonc
{
  "type": "form",
  "name": "Customer feedback",
  "config": { "kind":"form", "title":"...", "description":"...", "fields":[...], "policy":"public", ... }
}
```

## `POST /v1/forms/{view_id}/submissions`

Public submission endpoint. **No auth required** for `policy=public` forms; rate-limited per IP.

**Headers**: `cf-turnstile-token: <token>` (or `x-bypass-token` for tests).

**Body**: a key-value mapping keyed by `property_id` (or property name when permitted), values matching each property type's value envelope as in `docs/api/schemas/property-types.md`.

```jsonc
{
  "values": {
    "Name":   { "title":[{"type":"text","text":{"content":"Alex"}}] },
    "Email":  { "email":"alex@example.com" },
    "Rating": { "number": 9 }
  },
  "files": [ "<file-id-uploaded-via-presigned-PUT>" ]
}
```

**Response** (200):
```jsonc
{
  "object": "form_submission",
  "id": "uuid",
  "row_id": "uuid",
  "redirect_url": null | "https://..."
}
```

## `GET /v1/database_views/{view_id}/submissions`

Workspace-scoped listing of submissions for a form view.

Standard pagination. Result items include `submitter` (user id or null for anonymous), `client_ip` (workspace-only-policy forms), `created_at`, and the resulting `row_id`.

## Anti-abuse

- Cloudflare Turnstile (or equivalent) token validation when policy is `public`.
- Rate limit: 60 / hour per IP / form; 600 / hour per workspace.
- File uploads are pre-signed; size and MIME enforced server-side.

## Errors

| HTTP | Code |
|------|------|
| 400 | `invalid_request` (missing required field, wrong type) |
| 401 | `unauthorized` (workspace-only form, no session) |
| 403 | `restricted_resource` (people-policy form, not on allowlist) |
| 410 | `gone` (form closed by `close_at` or `max_submissions`) |
| 422 | `unprocessable_entity` (turnstile failed) |
| 429 | `rate_limited` |

## Tests

- E2E: submit a public form, assert row created in target DB.
- Chaos: oversize JSON, missing turnstile, wrong content-type, multiple-submit by same user when `single_submission_per_user=true` → 422.
- Observability: every submission produces `form.submit` span with `form_id`, `database_id`, `row_id`, `submitter` (or "anonymous").
- Benchmark: p99 submission < 350 ms.