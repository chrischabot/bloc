# Phase 19 — Sites & External Sync

## Goal

Publish pages to the web (Sites) including custom domains, and run external-data sync via Workers.

## Read first

- `docs/frontend/19-sites-publishing.md`
- `docs/api/endpoints/sites.md`
- `docs/api/endpoints/sync.md`

## Deliverables

1. `apps/web/app/(public)/[...slug]/page.tsx` public renderer.
2. Publish dialog UI + custom-domain wizard + DNS verification.
3. Sitemap.xml + robots.txt generation per workspace.
4. TLS provisioning hook (Let's Encrypt or platform-native).
5. Worker runtime in `apps/worker/src/runtime/`:
   - Sandbox executor with memory / time / egress limits.
   - Bundled standard library (no arbitrary file system, no network outside the egress allowlist).
   - Deploy + list + remove endpoints.
6. Sync binding CRUD + run-on-schedule worker.
7. Tests: anonymous public render; signed-in render; sync run against a stub source; oversized worker output truncated; DNS-not-propagated path.

## Todos

- [ ] 19.1 Public renderer route + ACL = public
- [ ] 19.2 Publish dialog + state persistence
- [ ] 19.3 Custom domain CRUD + DNS verification
- [ ] 19.4 Sitemap + robots
- [ ] 19.5 TLS provisioning hook
- [ ] 19.6 Worker runtime sandbox
- [ ] 19.7 Sync binding CRUD
- [ ] 19.8 Sync run scheduler
- [ ] 19.9 Stub Worker (test fixture) for GitHub / Jira / Salesforce
- [ ] 19.10 Contract / SDK / chaos / obs / benchmark green

## Definition of Done

- Universal DoD.
- Anonymous Playwright test: open the public URL of a published page, assert title, body, and CSP headers.
- Sync run smoke: stub Worker returns 100 rows; database reflects them within 2s.