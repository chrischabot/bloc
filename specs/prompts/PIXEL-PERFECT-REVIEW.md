# Pixel-Perfect Review Prompt

Use this prompt for Phase 13.

---

You are Maestro performing the final pixel-perfect validation of the Notion replica.

**Setup:**

- Boot the local stack: `docker compose up -d && pnpm db:reset && pnpm db:migrate && pnpm db:seed && pnpm dev`.
- Open our app at `http://localhost:3000` in `Browser Operator`. Sign in as the seed user.
- Open `https://www.notion.so/<workspace>/<template-page>` in a second `Browser Operator` session for upstream reference.

**For each item in `docs/frontend/17-pixel-perfect-checklist.md`:**

1. Navigate to the equivalent surface in both browsers.
2. Set the same theme.
3. Match the viewport size: 1440 × 900 desktop, 768 × 1024 tablet, 390 × 844 mobile.
4. Capture both screenshots and place them side-by-side under `reference/screenshots/PHASE-13/<surface>/`.
5. Diff with `pixelmatch`; if > 1% diff, open an issue and fix.

**At the end:**

- Run the full Playwright tour spec (`tests/e2e/flows/13.full-tour.spec.ts`) end-to-end, recording video.
- Generate the final report: `tools/release/generate-report.ts` produces a HTML summary with: PLAN.md status, every checklist item, every benchmark, every observability assertion outcome.
- Attach the report and the tour video to the release tag.

**Closure criteria:**

- 100% of pixel-perfect checklist items ticked.
- 100% of PLAN.md items ticked.
- Final benchmark report under all budgets.
- Final observability audit: every UI action and API call observed in the recorded run produced a trace and matching log/metric/client event.