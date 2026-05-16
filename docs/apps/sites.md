# Sites publishing

See [Web › Sites](../web/11-sites.md) for the UX. This page is the technical reference.

## How it works

When a page is published:

1. The page acquires a `public_url`.
2. Anonymous requests to `GET /v1/sites/{slug}` return the page's recordMap.
3. The web app's `/sites/[slug]` route renders the recordMap with `<NotionRenderer/>` (read-only).
4. Optional custom domains rewrite the URL to `https://docs.example.com/...`.

## Custom domains

Add: `POST /v1/workspaces/me/custom-domains` with `{ publication_id, domain }`. Bloc returns the DNS records to add (CNAME + ACME validation TXT).

After DNS propagates, hit `POST /v1/workspaces/me/custom-domains/{id}/verify`. On success, certs are issued via Let's Encrypt and traffic on the custom hostname is routed to the publication.

## SEO

The renderer sets:

- `<title>` — page title.
- `<meta name="description">` — first paragraph block, ~160 chars.
- `<meta property="og:image">` — page cover (else workspace icon).
- `<link rel="canonical">` — the `public_url`.
- `<meta name="robots" content="index, follow">` — unless `indexable: false`.

## Sitemap & robots

For each custom domain Bloc serves:

- `/sitemap.xml` — every published page.
- `/robots.txt` — allow / disallow rules.

If you'd rather control these yourself, set `BLOC_SITES_OWN_ROBOTS=1` and serve them at your reverse proxy.

## Caching

Anonymous reads cache for 60 s at the edge (`Cache-Control: public, max-age=60, s-maxage=300`). Authenticated reads bypass the cache.

## Forms on published pages

Form views embedded in a published page work for anonymous visitors when `public: true` on the form. The submit endpoint is rate-limited per IP. See [Forms](./forms.md).
