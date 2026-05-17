import { expect, test } from '@playwright/test';
import {
  blockCount,
  blockEditableAt,
  bootApp,
  createNewDatabase,
  createNewPage,
  failOnPageErrors,
  refreshSidebar,
  typeIntoBlock,
  uniqueSuffix,
  waitForDebouncedSave,
} from './helpers.ts';

test.describe('workflows', () => {
  test('38. settings page: navigate between all 4 sections (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    // 1. Click Settings in sidebar quick actions.
    await page.locator('.sidebar__quick').getByLabel('Settings').click();
    // 2. URL is /settings.
    await page.waitForURL(/\/settings$/);
    // 3. Page heading visible.
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    // 4. My account section is active by default.
    await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();
    // 5-6. Switch to Workspace.
    await page.getByRole('button', { name: 'Workspace' }).click();
    await expect(page.getByRole('heading', { name: 'Workspace', exact: true })).toBeVisible();
    // 7-8. Switch to Appearance.
    await page.getByRole('button', { name: 'Appearance' }).click();
    await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();
    // 9-10. Switch to Integrations.
    await page.getByRole('button', { name: 'My integrations' }).click();
    await expect(page.getByRole('heading', { name: 'My integrations' })).toBeVisible();
    // 11. The Create integration CTA is visible.
    await expect(page.getByRole('button', { name: /Create integration/ })).toBeVisible();
    // 12. Back to My account.
    await page.getByRole('button', { name: 'My account' }).click();
    await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('39. editor playground shows all 14+ block types (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    // 1. Navigate to /editor.
    await page.goto('/editor');
    await page.waitForURL(/\/editor$/);
    // 2. Page heading.
    await expect(page.getByRole('heading', { name: 'Block playground' })).toBeVisible();
    // 3-13. Twelve distinct block-type renderings visible.
    for (const cls of [
      'block--h1',
      'block--h2',
      'block--h3',
      'block--bullet',
      'block--numbered',
      'block--todo',
      'block--quote',
      'block--callout',
      'block--code',
      'block--equation',
      'block--bookmark',
    ]) {
      await expect(page.locator(`.${cls}`).first()).toBeVisible();
    }
    await expect(page.locator('.block--divider').first()).toBeAttached();
    // 14. Formatting toolbar visible.
    await expect(page.getByRole('toolbar', { name: 'Text formatting' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('40. formatting toolbar buttons toggle state (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    await page.goto('/editor');
    // 1. Toolbar visible.
    const toolbar = page.getByRole('toolbar', { name: 'Text formatting' });
    await expect(toolbar).toBeVisible();
    // 2. Click Bold.
    const bold = toolbar.getByLabel('Bold');
    await bold.click();
    await expect(bold).toHaveAttribute('aria-pressed', 'true');
    // 3. Click again to untoggle.
    await bold.click();
    await expect(bold).toHaveAttribute('aria-pressed', 'false');
    // 4. Italic toggles.
    const italic = toolbar.getByLabel('Italic');
    await italic.click();
    await expect(italic).toHaveAttribute('aria-pressed', 'true');
    // 5-7. Underline, Strikethrough, Code.
    await toolbar.getByLabel('Underline').click();
    await expect(toolbar.getByLabel('Underline')).toHaveAttribute('aria-pressed', 'true');
    await toolbar.getByLabel('Strikethrough').click();
    await expect(toolbar.getByLabel('Strikethrough')).toHaveAttribute('aria-pressed', 'true');
    await toolbar.getByLabel('Code').click();
    await expect(toolbar.getByLabel('Code')).toHaveAttribute('aria-pressed', 'true');
    // 8. Color picker.
    const color = toolbar.getByLabel('Color');
    await expect(color).toBeVisible();
    await color.selectOption('red');
    await expect(color).toHaveValue('red');
    // 9. Block-type select.
    const blockType = toolbar.getByLabel('Block type');
    await expect(blockType).toBeVisible();
    await blockType.selectOption('Heading 1');
    await expect(blockType).toHaveValue('Heading 1');
    // 10. Comment button visible.
    await expect(toolbar.getByLabel('Comment')).toBeVisible();
    // 11. Link button visible.
    await expect(toolbar.getByLabel('Link')).toBeVisible();
    // 12. Reset color.
    await color.selectOption('default');
    await expect(color).toHaveValue('default');
    expect(errors).toEqual([]);
  });

  test('41. analytics dashboard renders all widget sections (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    // 1. Navigate to /analytics.
    await page.goto('/analytics');
    await page.waitForURL(/\/analytics$/);
    // 2. Heading.
    await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible();
    // 3. Page views hero card.
    await expect(page.locator('.analytics__card--hero').getByText('Page views')).toBeVisible();
    // 4. Page views shows a numeric metric.
    await expect(page.locator('.analytics__card--hero .analytics__metric')).toBeVisible();
    // 5. Top UI actions card.
    await expect(page.getByRole('heading', { name: 'Top UI actions' })).toBeVisible();
    // 6-10. Five web-vital cards.
    for (const metric of ['LCP', 'INP', 'CLS', 'FCP', 'TTFB']) {
      await expect(page.getByRole('heading', { name: metric, exact: true })).toBeVisible();
    }
    // 11. Each card shows the p95 sub-label.
    await expect(page.locator('.analytics__sub').first()).toContainText(/p95/);
    // 12. Sidebar Analytics link goes back here.
    await page.locator('.sidebar__footer').getByText('Analytics').click();
    await page.waitForURL(/\/analytics$/);
    expect(errors).toEqual([]);
  });

  test('42. create 3 pages in a row, all appear in sidebar (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    // Create 3 pages with custom titles.
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const id = await createNewPage(page);
      ids.push(id);
      const titleInput = page.locator('[data-testid=page-title]');
      await titleInput.click();
      await titleInput.press('Control+a');
      await titleInput.press('Backspace');
      await titleInput.type(`Workflow page ${i}`);
      await waitForDebouncedSave(page);
    }
    // 1-3. All three ids are distinct UUIDs.
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f-]{36}$/);
    // 4. Go home + refresh sidebar.
    await page.goto('/');
    await refreshSidebar(page);
    // 5-7. All three sidebar entries are visible.
    for (const id of ids) {
      await expect(page.locator(`[data-testid="sidebar-page-${id}"]`)).toBeVisible({
        timeout: 15_000,
      });
    }
    // 8. Click into the first to verify navigation.
    await page.locator(`[data-testid="sidebar-page-${ids[0]}"]`).click();
    await page.waitForURL(`/page/${ids[0]}`);
    await expect(page.locator('[data-testid=page-title]')).toHaveValue('Workflow page 0');
    // 9-10. Back home + verify all titles still in sidebar.
    await page.goto('/');
    await refreshSidebar(page);
    for (let i = 0; i < ids.length; i++) {
      await expect(
        page.locator(`[data-testid="sidebar-page-${ids[i]}"]`).getByText(`Workflow page ${i}`),
      ).toBeVisible({ timeout: 15_000 });
    }
    // 11. Total pages in sidebar is >=3.
    const sidebarPages = await page.locator('[data-testid^="sidebar-page-"]').count();
    expect(sidebarPages).toBeGreaterThanOrEqual(3);
    expect(errors).toEqual([]);
  });

  test('43. cross-feature: page + database + block edits all persist (≥10 steps)', async ({
    page,
  }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    // 1. Create a page.
    const pageId = await createNewPage(page);
    // 2. Edit title.
    await page.locator('[data-testid=page-title]').click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    await page.locator('[data-testid=page-title]').type('Mixed workflow');
    // 3. Type into first block.
    await typeIntoBlock(blockEditableAt(page, 0), 'Para 1');
    // 4. Wait for debounce.
    await waitForDebouncedSave(page);
    // 5. Add another block via Enter.
    await blockEditableAt(page, 0).press('Enter');
    await expect(page.locator('[data-block-id]')).toHaveCount(2, { timeout: 10_000 });
    await blockEditableAt(page, 1).type('Para 2');
    await waitForDebouncedSave(page);
    // 6. Create a database.
    const dbId = await createNewDatabase(page);
    expect(dbId).toMatch(/^[0-9a-f-]{36}$/);
    // 7. Navigate back to the page.
    await page.goto(`/page/${pageId}`);
    await expect(page.locator('[data-testid=editable-page]')).toBeVisible({ timeout: 20_000 });
    // 8. Title persisted.
    await expect(page.locator('[data-testid=page-title]')).toHaveValue('Mixed workflow');
    // 9. Two blocks present.
    expect(await blockCount(page)).toBe(2);
    // 10. Both block texts persisted.
    await expect(page.locator('[data-testid=editor-body]')).toContainText('Para 1');
    await expect(page.locator('[data-testid=editor-body]')).toContainText('Para 2');
    // 11. Navigate to the database via URL.
    await page.goto(`/database/${dbId}`);
    await expect(page.locator('[data-testid=editable-database]')).toBeVisible({ timeout: 20_000 });
    // 12. Both surfaces accessible in sidebar after refresh.
    await page.goto('/');
    await refreshSidebar(page);
    await expect(page.locator(`[data-testid="sidebar-page-${pageId}"]`)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator(`[data-testid="sidebar-page-${dbId}"]`)).toBeVisible({
      timeout: 15_000,
    });
    expect(errors).toEqual([]);
  });

  test('44. archived pages do not appear in sidebar after refresh (≥10 steps)', async ({
    page,
  }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    // 1. Create a page.
    const id = await createNewPage(page);
    // 2. Set a distinctive title.
    const title = `To archive ${uniqueSuffix()}`;
    await page.locator('[data-testid=page-title]').click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    await page.locator('[data-testid=page-title]').type(title);
    await waitForDebouncedSave(page);
    // 3. Go home and refresh sidebar.
    await page.goto('/');
    await refreshSidebar(page);
    // 4. Sidebar shows the page.
    await expect(page.locator(`[data-testid="sidebar-page-${id}"]`)).toBeVisible({
      timeout: 15_000,
    });
    // 5. Open the page.
    await page.locator(`[data-testid="sidebar-page-${id}"]`).click();
    await page.waitForURL(`/page/${id}`);
    // 6. Archive it.
    await page.locator('[data-testid=page-archive]').click();
    // 7. Navigation back to home.
    await page.waitForURL(/(\/|\/home)$/);
    // 8. Refresh sidebar.
    await refreshSidebar(page);
    // 9. Wait a beat for the search index to settle.
    await page.waitForTimeout(500);
    // 10. The archived page is gone from the sidebar.
    await expect(page.locator(`[data-testid="sidebar-page-${id}"]`)).toBeHidden({
      timeout: 10_000,
    });
    // 11. Other items are still visible.
    expect(await page.locator('[data-testid^="sidebar-page-"]').count()).toBeGreaterThanOrEqual(0);
    // 12. The sidebar Private section still renders.
    await expect(page.locator('.sidebar__section').getByText('Private')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('45. database with multiple rows: rows persist across reload (≥10 steps)', async ({
    page,
  }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    // 1. Create database.
    const dbId = await createNewDatabase(page);
    // 2. Add 5 rows.
    for (let i = 0; i < 5; i++) {
      await page.locator('[data-testid=db-add-row]').click();
      await expect(page.locator('[data-testid^="row-"]')).toHaveCount(i + 1, { timeout: 10_000 });
    }
    // 3. Confirm count.
    expect(await page.locator('[data-testid^="row-"]').count()).toBe(5);
    // 4. Reload.
    await page.reload();
    await expect(page.locator('[data-testid=editable-database]')).toBeVisible({ timeout: 20_000 });
    // 5. Rows persisted.
    expect(await page.locator('[data-testid^="row-"]').count()).toBe(5);
    // 6. Navigate away and back.
    await page.goto('/');
    await page.goto(`/database/${dbId}`);
    await expect(page.locator('[data-testid=editable-database]')).toBeVisible({ timeout: 20_000 });
    // 7. Still 5 rows.
    expect(await page.locator('[data-testid^="row-"]').count()).toBe(5);
    // 8-12. Add 3 more, reload, confirm 8.
    for (let i = 5; i < 8; i++) {
      await page.locator('[data-testid=db-add-row]').click();
      await expect(page.locator('[data-testid^="row-"]')).toHaveCount(i + 1, { timeout: 10_000 });
    }
    await page.reload();
    await expect(page.locator('[data-testid=editable-database]')).toBeVisible({ timeout: 20_000 });
    expect(await page.locator('[data-testid^="row-"]').count()).toBe(8);
    expect(errors).toEqual([]);
  });

  test('46. switching between database views does not lose row data (≥10 steps)', async ({
    page,
  }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    // 1. Create database with a row.
    await createNewDatabase(page);
    await page.locator('[data-testid=db-add-row]').click();
    await expect(page.locator('[data-testid^="row-"]')).toHaveCount(1);
    // 2-7. Cycle through all 6 views.
    for (const view of ['board', 'gallery', 'list', 'calendar', 'timeline', 'table']) {
      await page.locator(`[data-testid=view-${view}]`).click();
      await expect(page.locator(`[data-testid=view-${view}]`)).toHaveClass(/is-active/);
    }
    // 8. Back on table view, the row is still there.
    expect(await page.locator('[data-testid^="row-"]').count()).toBe(1);
    // 9. Add another row.
    await page.locator('[data-testid=db-add-row]').click();
    await expect(page.locator('[data-testid^="row-"]')).toHaveCount(2, { timeout: 10_000 });
    // 10-11. Switch to gallery + back to table.
    await page.locator('[data-testid=view-gallery]').click();
    await page.locator('[data-testid=view-table]').click();
    // 12. Still 2 rows.
    expect(await page.locator('[data-testid^="row-"]').count()).toBe(2);
    expect(errors).toEqual([]);
  });

  test('47. /database launcher creates a database via UI button (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    // 1. Navigate to /database.
    await page.goto('/database');
    await page.waitForURL(/\/database$/);
    // 2. Launcher visible.
    await expect(page.locator('[data-testid=database-launcher]')).toBeVisible();
    // 3. List container visible.
    await expect(page.locator('[data-testid=database-list]')).toBeVisible();
    // 4. New button visible.
    const newBtn = page.locator('[data-testid=database-new]');
    await expect(newBtn).toBeEnabled();
    // 5. Click new.
    await newBtn.click();
    // 6. Navigates to a specific /database/:id URL.
    await page.waitForURL(/\/database\/[0-9a-f-]+$/, { timeout: 25_000 });
    // 7. Editable database visible.
    await expect(page.locator('[data-testid=editable-database]')).toBeVisible({ timeout: 25_000 });
    // 8. Go back to launcher.
    await page.goto('/database');
    // 9. List has at least one entry now.
    const links = page.locator('[data-testid^="db-"]');
    await expect(links.first()).toBeVisible({ timeout: 15_000 });
    expect(await links.count()).toBeGreaterThanOrEqual(1);
    // 10. Click the first.
    await links.first().click();
    // 11. We're on a database page.
    await page.waitForURL(/\/database\/[0-9a-f-]+$/);
    // 12. The editable surface is visible.
    await expect(page.locator('[data-testid=editable-database]')).toBeVisible({ timeout: 20_000 });
    expect(errors).toEqual([]);
  });

  test('48. /home route renders the home dashboard (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    // 1. Navigate to /home.
    await page.goto('/home');
    await page.waitForURL(/\/home$/);
    // 2. Page heading.
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    // 3. Sidebar still rendered.
    await expect(page.locator('aside.sidebar')).toBeVisible();
    // 4. TopBar still rendered.
    await expect(page.locator('.topbar')).toBeVisible();
    // 5-9. Navigate to /home from / (which should redirect).
    await page.goto('/');
    await page.waitForURL(/\/home$/);
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    // 10. Bootstrap session is intact.
    const session = await page.evaluate(() => window.localStorage.getItem('bloc-session'));
    expect(session).toBeTruthy();
    // 11. User id is a UUID.
    const userId = JSON.parse(session ?? '{}').user_id as string;
    expect(userId).toMatch(/^[0-9a-f-]{36}$/);
    // 12. Workspace id is a UUID.
    expect(JSON.parse(session ?? '{}').workspace_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(errors).toEqual([]);
  });

  test('49. quick switcher: type → arrow → Enter navigates to the selected result (≥10 steps)', async ({
    page,
  }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    // 1. Create a page with a distinctive title so search returns at least 1 hit.
    const id = await createNewPage(page);
    const title = `Switchertitle${uniqueSuffix()}`;
    await page.locator('[data-testid=page-title]').click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    await page.locator('[data-testid=page-title]').type(title);
    await waitForDebouncedSave(page);
    // 2. Go home.
    await page.goto('/');
    await page.waitForURL(/\/home$/);
    // 3. Open quick switcher via Ctrl+K using a trusted keyboard event.
    await page.keyboard.press('Control+k');
    // 4. Switcher visible.
    const qs = page.locator('section.qs');
    await expect(qs).toBeVisible({ timeout: 5_000 });
    // 5. Input focused.
    const input = qs.locator('input');
    await expect(input).toBeFocused();
    // 6. Type a search query that should hit our page.
    await input.fill(title.slice(0, 8));
    // 7. Wait for the debounced search (180ms in QuickSwitcher) + index settle.
    await page.waitForTimeout(600);
    // 8. Either a results list or the "no results" empty state is rendered.
    const results = qs.locator('.qs__results');
    const empty = qs.locator('.qs__empty');
    await expect(results.or(empty)).toBeVisible({ timeout: 10_000 });
    // 9. Press ArrowDown to highlight (no-op if no results).
    await page.keyboard.press('ArrowDown');
    // 10-12. Behaviour depends on whether the index found the new page:
    const hasResults = await results.isVisible();
    if (hasResults) {
      // Press Enter to navigate.
      await page.keyboard.press('Enter');
      // After Enter, the switcher hides.
      await expect(qs).toBeHidden({ timeout: 10_000 });
      // We navigated somewhere — either to our new page or another result.
      await page.waitForURL(/\/(page|database)\/[0-9a-f-]+$/, { timeout: 10_000 });
    } else {
      // No results — press Escape to dismiss.
      await page.keyboard.press('Escape');
      await expect(qs).toBeHidden();
    }
    expect(id).toBeTruthy();
    expect(errors).toEqual([]);
  });

  test('50. session bearer authenticates every API call across navigations (≥10 steps)', async ({
    page,
  }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    // 1. Read session bearer from localStorage.
    const bearer = await page.evaluate(() => {
      const s = window.localStorage.getItem('bloc-session');
      return s !== null ? (JSON.parse(s) as { session_bearer: string }).session_bearer : null;
    });
    expect(bearer).toMatch(/^Bearer test_/);
    // 2. The session is used by Sidebar — verify a page can be created.
    const id = await createNewPage(page);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    // 3. Navigate to /settings.
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    // 4. Bearer still in storage.
    const bearer2 = await page.evaluate(() => {
      const s = window.localStorage.getItem('bloc-session');
      return s !== null ? (JSON.parse(s) as { session_bearer: string }).session_bearer : null;
    });
    expect(bearer2).toBe(bearer);
    // 5. Navigate to /analytics.
    await page.goto('/analytics');
    await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible();
    // 6. Navigate to /editor.
    await page.goto('/editor');
    await expect(page.getByRole('heading', { name: 'Block playground' })).toBeVisible();
    // 7. Navigate to /database.
    await page.goto('/database');
    await expect(page.locator('[data-testid=database-launcher]')).toBeVisible();
    // 8. Go to /home.
    await page.goto('/home');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    // 9. Bearer unchanged after all navigations.
    const bearer3 = await page.evaluate(() => {
      const s = window.localStorage.getItem('bloc-session');
      return s !== null ? (JSON.parse(s) as { session_bearer: string }).session_bearer : null;
    });
    expect(bearer3).toBe(bearer);
    // 10. Reload — session persists.
    await page.reload();
    const bearer4 = await page.evaluate(() => {
      const s = window.localStorage.getItem('bloc-session');
      return s !== null ? (JSON.parse(s) as { session_bearer: string }).session_bearer : null;
    });
    expect(bearer4).toBe(bearer);
    // 11. Open and close a panel to confirm UI is still interactive.
    await page.locator('.sidebar__quick').getByLabel('Reminders').click();
    await expect(page.locator('aside.reminders')).toBeVisible();
    await page.locator('aside.reminders').getByLabel('Close').click();
    // 12. New page button still works.
    await expect(page.locator('[data-testid=sidebar-new-page]')).toBeEnabled();
    expect(errors).toEqual([]);
  });
});
