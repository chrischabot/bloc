# Visual Regression Tests

## Tool

Playwright's `toHaveScreenshot` (Chromium screenshot diff), augmented by `pixelmatch` for fine-grained per-pixel comparison when needed.

## Reference set

`reference/screenshots/<phase>/<surface>/<theme>.png` contains canonical reference images.

**Usage policy.** Reference screenshots from notion.so are used **for internal visual comparison only** within the test pipeline. They are:

- Not redistributed outside this repository.
- Not published as part of the deployed product.
- Not used as input to any generative model.
- Captured from the agent's own logged-in workspace using public template pages or pages we have rights to view, never from third-party private content.
- Treated as derivative reference material; any use that exceeds internal comparison must be cleared with project legal counsel first.

A `reference/screenshots/LICENSE-NOTE.md` file is kept beside the screenshots restating this policy and providing the agent with a short answer if asked.

- Captured from notion.so via `Browser Operator` / Playwright in line with the policy above.
- Captured at a fixed viewport: 1440 × 900 desktop, 768 × 1024 tablet, 390 × 844 mobile.
- Both `data-theme="light"` and `data-theme="dark"`.

## Workflow

1. `tools/screenshot/capture-reference.ts` opens notion.so in a logged-in template workspace, navigates each surface, and saves PNGs to `reference/screenshots/`.
2. `tests/visual/` opens our app at the equivalent URL in the same viewport and saves a PNG to `tests/visual/__snapshots__/`.
3. `pixelmatch` compares them with a threshold of `0.1` and counts diff pixels; fail if > 1% of total pixels differ.

## Anti-aliasing

Browsers render text with slightly different anti-aliasing across runs (especially on different OSes). Mitigations:

- Pin the Playwright Chromium version.
- Disable system font fallback (use bundled Inter / Source Serif / JetBrains Mono).
- Compare with `pixelmatch`'s `aaColor` ignore zone.
- Allow 0.5% noise budget; reserve the remaining 0.5% for genuine drift.

## What to snapshot

| Surface | Snapshot |
|---------|----------|
| Sidebar | all sections expanded; one row hovered |
| Editor | empty page; populated with every block type |
| Slash menu | open at empty paragraph |
| Formatting toolbar | open over selected text |
| Database table view | 100 rows, all columns |
| Database board view | 5 columns × 10 cards |
| Database calendar | current month |
| Database timeline | one month visible |
| Share dialog | open |
| Comments panel | one thread |
| Inbox | one notification |
| Settings | every section |

## Test command

```
pnpm test:visual            # run
pnpm test:visual -- --update # accept new baselines (manual review required in PR)
```

## CI handling

- Visual diffs are uploaded as artifacts.
- Baseline updates require an explicit `visual-baseline-update` label on the PR and a code-owner approval.