# Phase 5 — Search, Comments, Users

## Goal

Complete the REST surface: search, comments, users.

## Read first

- `docs/api/endpoints/search.md`
- `docs/api/endpoints/comments.md`
- `docs/api/endpoints/users.md`
- `docs/architecture/04-storage-strategy.md#search`

## Deliverables

1. `apps/api/src/routes/{search,comments,users}.ts`.
2. Indexer worker in `apps/worker/src/jobs/index-page.ts` subscribed to `block.mutated` and `page.updated` events; debounce 500ms per page; writes to MeiliSearch.
3. MeiliSearch index setup (filterable: `workspace_id`, `parent_id`, `object_type`; sortable: `last_edited_time`).
4. Mention resolution (`@user`, `@page`, `@date`) on comment create — referenced users/pages must be permission-checked.
5. SDK additions in `packages/sdk/src/{search,comments,users}.ts`.
6. Contract / SDK / chaos / obs / benchmark green.
7. Latency: indexer convergence asserted ≤ 5s.

## Todos

- [ ] 5.1 POST /search
- [ ] 5.2 Users endpoints
- [ ] 5.3 Comments endpoints
- [ ] 5.4 Indexer worker
- [ ] 5.5 Mention resolution

## Definition of Done

- Universal DoD.
- After a page edit, search hits return the new content within 5s, asserted in an integration test.
- `created_by` on a comment matches the bearer's user/bot.