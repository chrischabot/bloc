# Sites publishing

Make a page (or a tree of pages) publicly visitable on the web with optional custom domain.

## Publish a page

`POST /v1/pages/{page_id}/publish`

```json
{
  "include_subpages": true,
  "navigation": "sidebar" | "breadcrumbs" | "none",
  "theme":      "light" | "dark" | "auto",
  "search":     true,
  "indexable":  true
}
```

Response:

```json
{
  "object": "site_publication",
  "id": "uuid",
  "page_id": "uuid",
  "public_url": "https://<host>/sites/<slug>",
  "options": { ... },
  "status": "active",
  "published_at": "..."
}
```

## Unpublish

`DELETE /v1/pages/{page_id}/publish`

## Retrieve a publication

`GET /v1/pages/{page_id}/publish`

## Public read

`GET /v1/sites/{slug}` — no auth. Returns the page's `recordMap` for the publisher's renderer.

`GET /v1/sites/{slug}/{sub_slug}` — read sub-page when `include_subpages: true`.

## Custom domains

`POST /v1/workspaces/me/custom-domains`

```json
{ "publication_id": "uuid", "domain": "docs.example.com" }
```

Bloc generates DNS records; verify with `POST /v1/workspaces/me/custom-domains/{id}/verify`. Once verified, the publication serves at `https://docs.example.com`.

## Notes

- Public sites are anonymous-accessible. ACL still applies for any *non-published* pages they link to — those return 404 to anonymous visitors.
- Sites are indexed by search engines unless `indexable: false`.
- Traffic to `/v1/sites/*` doesn't require a bearer; it does count toward IP-based rate limits.
