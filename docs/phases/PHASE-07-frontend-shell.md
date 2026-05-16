# Phase 7 — Frontend Shell

## Goal

Next.js 15 app with React 19 — shell, design system, sidebar pixel-matched.

## Read first

- `docs/frontend/00-ui-overview.md`
- `docs/frontend/01-design-system.md`
- `docs/frontend/02-component-library.md`
- `docs/frontend/03-layout.md`
- `docs/frontend/04-sidebar.md`
- `docs/frontend/17-pixel-perfect-checklist.md`

## Deliverables

1. `apps/web` boots with App Router; `/` redirects to `/<workspaceSlug>/<lastPageId>`.
2. Design tokens compiled to `apps/web/styles/tokens.css`; auto-generated from `packages/ui/src/tokens/`.
3. Primitive components in `packages/ui/src/components/` from `02-component-library.md`.
4. App shell (`apps/web/app/(workspace)/layout.tsx`).
5. Sidebar with workspace switcher, quick actions, sections (Favourites/Teamspaces/Shared/Private), page tree, footer.
6. Sidebar drag-resize, collapse, persisted width.
7. Theme switching (Light/Dark/System).
8. Playwright tests on shell + sidebar interactions.
9. Visual regression vs `reference/screenshots/sidebar-*.png` < 1% diff.

## Todos

- [ ] 7.1 Next.js + React 19 + RSC
- [ ] 7.2 Design tokens
- [ ] 7.3 App shell
- [ ] 7.4 Sidebar full
- [ ] 7.5 Sidebar drag-resize / collapse / DnD reordering
- [ ] 7.6 Light + dark theme exact match
- [ ] 7.7 Playwright + visual regression

## Definition of Done

- Universal DoD.
- Pixel-perfect checklist items for shell + sidebar all ticked.
- Lighthouse perf ≥ 90 on `/` cold and warm.

## Pitfalls

- Server-rendered theme: persist user theme on the user row and emit a `<script>` that sets `data-theme` synchronously in `<head>` to avoid FOUC.
- Sidebar drag-resize must not trigger layout thrash; use CSS variable + `requestAnimationFrame`.