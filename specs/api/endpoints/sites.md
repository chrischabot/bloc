# Sites & Publishing Endpoints

See `docs/frontend/19-sites-publishing.md`.

## `GET /v1/pages/{page_id}/publication`

Retrieve the current publication state.

**Response** (200):
```jsonc
{
  "object": "publication",
  "page_id": "uuid",
  "state": "live" | "draft" | "expired",
  "url": "https://workspace.notion.site/<slug>-<hash>",
  "custom_domain": null | "docs.example.com",
  "allow_edit": false,
  "allow_comment": true,
  "allow_duplicate": false,
  "index_in_search": true,
  "show_toc": true,
  "show_navbar": true,
  "expires_at": null,
  "created_at": "...",
  "updated_at": "..."
}
```

## `POST /v1/pages/{page_id}/publication`

Publish (or republish). Body uses the same shape as response, omitting derived fields. Returns the updated publication.

## `DELETE /v1/pages/{page_id}/publication`

Unpublish (204).

## Custom domains

### `GET /v1/workspaces/{id}/custom_domains`

List custom domains for the workspace.

### `POST /v1/workspaces/{id}/custom_domains`

```jsonc
{ "domain": "docs.example.com", "page_id": "uuid" }
```

Response includes `dns_records` to be set at the registrar and `status: "pending"`.

### `GET /v1/workspaces/{id}/custom_domains/{domain_id}`

Returns the current status (`pending`, `provisioning`, `live`, `failed`) and TLS certificate status.

### `DELETE /v1/workspaces/{id}/custom_domains/{domain_id}`

Remove the binding; the page reverts to the `notion.site` URL.

## Auth / permissions

- Publish / unpublish: requires `full_access` on the page **and** workspace owner / admin role (configurable per workspace policy).
- Custom domains: workspace owner only.

## Errors

| HTTP | Code |
|------|------|
| 400 | `invalid_request` (invalid domain shape, public URL in body) |
| 402 | `restricted_resource` (custom domain requires paid plan) |
| 409 | `conflict_error` (domain already bound to another workspace) |
| 422 | `unprocessable_entity` (DNS not yet propagated) |

## Tests

- E2E: publish a page, hit the public URL anonymously, assert HTML + correct CSP.
- Chaos: domain pointing at a private IP, infinite CNAME, expired TLS — handled with `failed` status, surfaced to the user.
- Observability: `publication.created/updated/deleted` spans + audit events.