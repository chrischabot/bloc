# Sites publishing

Make any page (or a tree of pages) reachable on the public web, with optional custom domain.

## Publish a page

1. Open the page.
2. Top bar → **Share** → **Publish** tab.
3. Choose options:
   - **Include sub-pages** — recursive publish.
   - **Navigation** — sidebar, breadcrumbs, or none.
   - **Theme** — light / dark / auto.
   - **Search** — enable the search bar on the public site.
   - **Indexable** — let search engines index it.
4. Click **Publish**.

The public URL appears at the top of the panel. Copy and share it.

## Unpublish

Same panel → **Unpublish**. The URL 404s immediately for anonymous visitors. Members of the workspace continue to see the page in the app.

## Custom domain

In **Settings → Sites** (admin):

1. Add a domain (e.g. `docs.example.com`).
2. Bloc displays a CNAME record. Add it to your DNS.
3. Click **Verify**. Once green, your published pages can point at this domain.
4. Back on the page's publish panel, pick the domain from the **Domain** dropdown.

TLS is handled automatically via Let's Encrypt; allow a minute for the cert to issue on first publish.

## Forms

A form view on a database is publicly submittable. To embed:

- Slash menu → **Form** → pick a form view of an existing database.
- Or share the form's standalone URL from the database's view menu.

Submissions create database rows; the workflow afterwards (notifications, automations) is configured on the database.

## Indexing & analytics

Published pages emit `page_view` beacons just like internal pages. The admin **Insights** panel shows traffic.

For SEO meta:

- Title — page title.
- Description — first paragraph block.
- OG image — page cover (if set), else workspace icon.
- Robots — `index, follow` unless `Indexable: false`.

## Limits

- Maximum 10k published pages per workspace.
- Maximum size of a published page: 5 MB rendered HTML.
- Custom domains: 5 per workspace by default.
