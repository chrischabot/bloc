# Notion Sites & Public Publishing

Any page can be published to the public web. Published trees are served from `<workspace-slug>.notion.site` (free) or from a workspace-owned custom domain.

## Publish dialog

Invoked from the TopBar Share button → **Publish** tab (see `11-page-header.md#share`).

Controls:

- **Publish to web** toggle.
- When on:
  - **Web link** with copy button.
  - **Search-engine indexing** toggle.
  - **Allow editing** toggle.
  - **Allow comments** toggle.
  - **Allow duplicate as template** toggle.
  - **Expire after** (off / 1d / 7d / 30d / custom).
  - **Show table of contents** toggle.
  - **Show navbar** toggle.
  - **Password protection** (Business+).
- **Custom domain** — Workspace owners on paid plans only. Wizard:
  1. Enter `your-domain.com`.
  2. Display the CNAME / TXT records to add at the registrar.
  3. Poll the DNS until propagation; status badge (`Pending`, `Provisioning`, `Live`, `Failed`).
  4. Auto-issue and renew TLS via Let's Encrypt.

## Site settings (workspace level)

`Settings → Sites`:

- **My sites** — list of published top-level pages.
- **Custom domains** — list with `connected to: <page>` and remove.
- **SEO defaults** — default OG image, default favicon, robots policy.
- **Analytics** — built-in pageview counter (privacy-friendly, no fingerprinting); optional GA4 hook.

## URL shape

- Free: `https://<workspace>.notion.site/<page-slug>-<hash>`
- Custom: `https://<custom-domain>/<page-slug>` (no hash because the custom domain owner controls the namespace).

Slugs are derived from the title, kebab-cased; trailing hash is a 22-char Crockford base32 of the page UUID, present only on `notion.site` to disambiguate.

## Rendering

- Published pages are rendered server-side via a separate Next.js route (`apps/web/app/(public)/[...slug]/page.tsx`).
- Anonymous viewers get a read-only renderer (no edit affordances, no slash menu).
- If `Allow comments` is on, viewers can comment if they sign in or as guests with email verification.
- If `Allow duplicate as template` is on, a top-right "Duplicate" button copies the entire subtree into the user's workspace.

## Layout

- Site shell:
  - Top: optional navbar with workspace icon + page tree (auto-built from the sub-pages of the published root).
  - Body: the page's content.
  - Footer: "Powered by Notion" link (removable on paid plans).
- Theme: respects the page's font + width settings; viewer can toggle light/dark.
- Responsive: collapses navbar to hamburger on `≤md`.

## SEO

- `<title>`, `<meta description>` derived from page title + first paragraph.
- OG image: page cover if present, otherwise auto-generated card.
- Sitemap.xml at `/sitemap.xml`.
- robots.txt obeys the indexing toggle.

## Data model additions

```
publications (
  id uuid PK,
  page_id uuid REFERENCES pages(id),
  state text CHECK ('draft','live','expired'),
  url text,
  custom_domain_id uuid NULL,
  allow_edit bool, allow_comment bool, allow_duplicate bool,
  expires_at timestamptz NULL,
  index_in_search bool,
  show_toc bool, show_navbar bool,
  password_hash text NULL,
  created_at, updated_at
)
custom_domains (
  id uuid PK,
  workspace_id uuid,
  domain text UNIQUE,
  status text,
  tls_cert_arn text,
  dns_records jsonb,
  created_at
)
```

## API additions

- `POST /v1/pages/:id/publication` — publish; body matches dialog state.
- `GET /v1/pages/:id/publication` — get current publication.
- `DELETE /v1/pages/:id/publication` — unpublish.
- `POST /v1/workspaces/:id/custom_domains` — register.
- `GET /v1/workspaces/:id/custom_domains` — list with statuses.
- `DELETE /v1/workspaces/:id/custom_domains/:domain_id` — remove.

## Tests

- E2E: publish a page → assert public URL renders without auth.
- Visual: the public renderer at the same viewport as the editor; check navbar + footer.
- Chaos: malicious custom domain (CNAME loop, internal IP), oversized robots, expired publication → clean 4xx and the public path serves a 404.
- Observability: publication state changes write `audit_events`; public renderer span carries `publication.id`.