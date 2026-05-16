# E2E Tests (Playwright)

## Tool

Playwright with a project per supported browser: chromium (primary), firefox, webkit.

## File layout

```
tests/e2e/
├── playwright.config.ts
├── fixtures/                 // signed-in page fixtures
├── pages/                    // page-object models
├── flows/
│   ├── 00.smoke.spec.ts
│   ├── 07.sidebar.spec.ts
│   ├── 08.editor-blocks.spec.ts
│   ├── 09.database-views.spec.ts
│   ├── 10.realtime.spec.ts
│   ├── 11.share-comments.spec.ts
│   └── 13.full-tour.spec.ts
└── helpers/
```

## Conventions

- Use page-object models (`tests/e2e/pages/EditorPage.ts`, etc.) — keep selector logic out of specs.
- Prefer role-based locators (`getByRole('button', { name: 'Share' })`); fallback to `data-testid` only when necessary.
- Tests sign in via API (set session cookie) — not via UI — for speed and isolation.
- Reset DB before each spec (via `globalSetup`).

## Smoke test (Phase 0)

```ts
test.describe('smoke', () => {
  test('shell loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Sidebar' })).toBeVisible();
    await expect(page.locator('[data-block-id]').first()).toBeVisible();
  });
});
```

## Visual regression

Each spec optionally calls `await expect(page).toHaveScreenshot('editor-empty.png', { maxDiffPixelRatio: 0.01 })`. Reference images live under `tests/e2e/__screenshots__/<spec>/<theme>/`.

## Network policy

Tests run against the local stack. No outbound network. Tests fail if any external host is contacted (enforced via Playwright's `context.route('**', ...)` allowlist).

## Reporting

- HTML reporter for human review.
- JUnit XML for CI.
- Trace and video on failure; both attached to the workflow run.

## Performance test gate

A subset of specs are tagged `@perf`. They run with `--workers=1` and assert per-interaction p95 (via `performance.measure`) against the budgets in `docs/testing/08-benchmarks.md`.