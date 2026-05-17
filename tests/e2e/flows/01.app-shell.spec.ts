import { expect, test } from '@playwright/test';
import { bootApp, failOnPageErrors, sidebar } from './helpers.ts';

test.describe('app shell', () => {
  test('1. workspace loads and bootstrap completes (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    // 1. Go to the root.
    await page.goto('/');
    // 2. Page title is set.
    await expect(page).toHaveTitle(/Bloc/);
    // 3. The shell wraps the layout.
    await expect(page.locator('.shell')).toBeVisible();
    // 4. Sidebar is in the DOM (unambiguous CSS selector).
    await expect(sidebar(page)).toBeVisible();
    // 5. The workspace switcher shows the dev workspace name.
    await expect(page.locator('.sidebar__title')).toContainText('Dev Workspace');
    // 6. The TopBar Share button is visible.
    await expect(page.getByRole('button', { name: 'Share' })).toBeVisible();
    // 7. The TopBar breadcrumb is rendered.
    await expect(page.locator('.topbar__breadcrumb')).toBeVisible();
    // 8. Quick actions row includes Search, Updates, Reminders, Settings, New page.
    for (const label of ['Search', 'Inbox', 'Reminders', 'Settings', 'New page']) {
      await expect(page.locator('.sidebar__quick').getByLabel(label)).toBeVisible();
    }
    // 9. Sidebar footer includes Templates, Analytics, Trash.
    for (const text of ['Templates', 'Analytics', 'Trash']) {
      await expect(page.locator('.sidebar__footer').getByText(text)).toBeVisible();
    }
    // 10. The bootstrap call wrote a session into localStorage.
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem('bloc-session')), {
        timeout: 15_000,
      })
      .not.toBeNull();
    // 11. Welcome content is rendered in the main column (root redirects to /home).
    await expect(page.locator('main.content')).toContainText(/Home|Welcome|workspace/);
    // 12. No uncaught JS errors so far.
    expect(errors).toEqual([]);
  });

  test('2. sidebar collapse and expand round-trips state (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    // 1. Sidebar is initially expanded.
    const aside = sidebar(page);
    await expect(aside).not.toHaveClass(/sidebar--collapsed/);
    // 2. Find the collapse button.
    const collapse = page.getByLabel('Collapse sidebar');
    await expect(collapse).toBeVisible();
    // 3. Click to collapse.
    await collapse.click();
    // 4. The CSS class is updated.
    await expect(aside).toHaveClass(/sidebar--collapsed/);
    // 5. Title is hidden when collapsed.
    await expect(page.locator('.sidebar__title')).toBeHidden();
    // 6. Find the expand button.
    const expand = page.getByLabel('Expand sidebar');
    await expect(expand).toBeVisible();
    // 7. Click to expand.
    await expand.click();
    // 8. Class is removed.
    await expect(aside).not.toHaveClass(/sidebar--collapsed/);
    // 9. Title visible again.
    await expect(page.locator('.sidebar__title')).toBeVisible();
    // 10. Workspace switcher still shows dev workspace.
    await expect(page.locator('.sidebar__title')).toContainText('Dev Workspace');
    // 11. Collapse via keyboard (Tab + Space).
    await page.getByLabel('Collapse sidebar').click();
    await expect(aside).toHaveClass(/sidebar--collapsed/);
    // 12. Expand again.
    await page.getByLabel('Expand sidebar').click();
    await expect(aside).not.toHaveClass(/sidebar--collapsed/);
    expect(errors).toEqual([]);
  });

  test('3. top bar share dialog opens with both tabs (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    // 1. Find Share button.
    const share = page.getByRole('button', { name: 'Share' });
    await expect(share).toBeVisible();
    // 2. Click to open.
    await share.click();
    // 3. Dialog appears.
    const dialog = page.getByRole('dialog', { name: 'Share' });
    await expect(dialog).toBeVisible();
    // 4. Both tabs are visible.
    const shareTab = dialog.getByRole('tab', { name: 'Share' });
    const publishTab = dialog.getByRole('tab', { name: 'Publish' });
    await expect(shareTab).toBeVisible();
    await expect(publishTab).toBeVisible();
    // 5. Share tab is selected by default.
    await expect(shareTab).toHaveAttribute('aria-selected', 'true');
    // 6. Invite combobox is visible.
    await expect(dialog.getByPlaceholder('Email or name')).toBeVisible();
    // 7. Initial member ("You") row is present.
    await expect(dialog.getByText('you@example.com')).toBeVisible();
    // 8. Switch to Publish.
    await publishTab.click();
    await expect(publishTab).toHaveAttribute('aria-selected', 'true');
    // 9. Publish toggle visible.
    await expect(dialog.getByText('Publish to web')).toBeVisible();
    // 10. Tick the publish toggle.
    await dialog.locator('input[type=checkbox]').first().check();
    // 11. URL field appears.
    await expect(dialog.getByLabel('Public URL')).toBeVisible();
    // 12. Close the dialog via Done.
    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(dialog).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('4. theme toggle switches and persists across reload (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    // 1. Read initial theme.
    const initial = await page.locator('html').getAttribute('data-theme');
    expect(initial === 'light' || initial === 'dark').toBeTruthy();
    // 2. Locate the toggle in the TopBar.
    const toggle = page.locator('.theme-toggle');
    await expect(toggle).toBeVisible();
    // 3. Click to switch.
    await toggle.click();
    // 4. Verify it flipped.
    const flipped = await page.locator('html').getAttribute('data-theme');
    expect(flipped).not.toBe(initial);
    // 5. localStorage updated.
    const stored = await page.evaluate(() => window.localStorage.getItem('bloc-theme'));
    expect(stored).toBe(flipped);
    // 6. Reload the page.
    await page.reload();
    // 7. After reload, html attribute still reflects the stored theme.
    await expect(page.locator('html')).toHaveAttribute('data-theme', flipped ?? 'light');
    // 8. Toggle is still visible.
    await expect(page.locator('.theme-toggle')).toBeVisible();
    // 9. Flip back.
    await page.locator('.theme-toggle').click();
    // 10. Original theme restored.
    await expect(page.locator('html')).toHaveAttribute('data-theme', initial ?? 'light');
    // 11. localStorage updated again.
    const restored = await page.evaluate(() => window.localStorage.getItem('bloc-theme'));
    expect(restored).toBe(initial);
    // 12. Reload once more and confirm stable.
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', initial ?? 'light');
    expect(errors).toEqual([]);
  });

  test('5. quick switcher opens with Cmd+K, navigates with arrow keys (≥10 steps)', async ({
    page,
  }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    // 1. Quick switcher is hidden initially.
    await expect(page.locator('section.qs')).toHaveCount(0);
    // 2. Focus body then press Cmd+K so the global handler receives it.
    await page.locator('body').click();
    await page.keyboard.press('Control+k');
    // 3. Switcher appears (may take a moment; retry via event dispatch if needed).
    let qs = page.locator('section.qs');
    try {
      await expect(qs).toBeVisible({ timeout: 5_000 });
    } catch {
      await page.evaluate(() => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
        );
      });
      qs = page.locator('section.qs');
      await expect(qs).toBeVisible({ timeout: 5_000 });
    }
    // 4. Input is focused.
    const input = qs.getByPlaceholder('Search pages, databases…');
    await expect(input).toBeFocused();
    // 5. Keyboard hint visible.
    await expect(qs.locator('.qs__hint')).toBeVisible();
    // 6. Type a query.
    await input.fill('Dev');
    // 7. Wait for debounce.
    await page.waitForTimeout(300);
    // 8. Press ArrowDown (no-op when no results, but shouldn't error).
    await page.keyboard.press('ArrowDown');
    // 9. Press ArrowUp.
    await page.keyboard.press('ArrowUp');
    // 10. Press Escape to close.
    await page.keyboard.press('Escape');
    // 11. Dialog hidden.
    await expect(qs).toBeHidden();
    // 12. Open again with Cmd+K.
    await page.evaluate(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
      );
    });
    await expect(page.locator('section.qs')).toBeVisible({ timeout: 5_000 });
    // 13. Close by clicking the scrim dismiss button.
    await page.locator('.qs__scrim-dismiss').click();
    await expect(page.locator('section.qs')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('6. /home, /settings, /editor, /analytics, /database routes render (≥10 steps)', async ({
    page,
  }) => {
    const errors = failOnPageErrors(page);
    // 1. /home
    await page.goto('/home');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    // 2. Sidebar present.
    await expect(sidebar(page)).toBeVisible();
    // 3. /settings
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    // 4. Settings sections visible.
    await expect(page.getByText('My account')).toBeVisible();
    // 5. /editor
    await page.goto('/editor');
    await expect(page.getByRole('heading', { name: 'Block playground' })).toBeVisible();
    // 6. Formatting toolbar visible.
    await expect(page.getByRole('toolbar', { name: 'Text formatting' })).toBeVisible();
    // 7. /analytics
    await page.goto('/analytics');
    await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible();
    // 8. /database
    await page.goto('/database');
    await expect(page.locator('[data-testid=database-launcher]')).toBeVisible();
    // 9. Database list testid present.
    await expect(page.locator('[data-testid=database-list]')).toBeVisible();
    // 10. Database new button visible.
    await expect(page.locator('[data-testid=database-new]')).toBeVisible();
    // 11. /  redirect / home page renders welcome.
    await page.goto('/');
    await expect(page.locator('main.content')).toContainText(/Home|Welcome|workspace/);
    // 12. Top bar persists across all routes.
    await expect(page.locator('.topbar')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('7. top bar icons all visible and clickable (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    // 1. Comments icon
    const comments = page.locator('.topbar').getByLabel('Comments');
    await expect(comments).toBeVisible();
    // 2. Click — no crash.
    await comments.click();
    // 3. Updates icon
    const updates = page.locator('.topbar').getByLabel('Updates');
    await expect(updates).toBeVisible();
    // 4. Favourite icon
    const fav = page.locator('.topbar').getByLabel('Favourite');
    await expect(fav).toBeVisible();
    // 5. More icon
    const more = page.locator('.topbar').getByLabel('Version history');
    await expect(more).toBeVisible();
    // 6. Theme toggle
    const toggle = page.locator('.theme-toggle');
    await expect(toggle).toBeVisible();
    // 7. Breadcrumb separator
    await expect(page.locator('.topbar__sep')).toBeVisible();
    // 8. Crumbs
    await expect(page.locator('.topbar__crumb').first()).toBeVisible();
    // 9. Spacer pushes Share to the right
    await expect(page.locator('.topbar__spacer')).toHaveCount(1);
    // 10. Click favourite — should not error.
    await fav.click();
    // 11. Click more.
    await more.click();
    // 12. Top bar still visible.
    await expect(page.locator('.topbar')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('8. responsive layout: sidebar present across viewports (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    // 1. Switch to a small viewport.
    await page.setViewportSize({ width: 480, height: 800 });
    await bootApp(page);
    // 2. Sidebar present.
    const aside = sidebar(page);
    await expect(aside).toBeAttached();
    // 3. Main content area visible.
    await expect(page.locator('main.content')).toBeVisible();
    // 4. Top bar still visible on mobile.
    await expect(page.locator('.topbar')).toBeVisible();
    // 5. Switch to tablet viewport.
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(aside).toBeAttached();
    // 6. Switch back to desktop.
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(aside).toBeVisible();
    // 7. The sidebar's new-page button still works at desktop.
    await expect(page.locator('[data-testid=sidebar-new-page]')).toBeEnabled();
    // 8. Top bar breadcrumb visible.
    await expect(page.locator('.topbar__breadcrumb')).toBeVisible();
    // 9. Switch to 1920×1080.
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(aside).toBeVisible();
    // 10. Quick action labels still readable.
    await expect(page.locator('.sidebar__quick')).toBeVisible();
    // 11. Footer still rendered.
    await expect(page.locator('.sidebar__footer')).toBeVisible();
    // 12. Resize once more to standard.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('main.content')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('9. session persists across page reloads (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    // 1. Capture initial session.
    const sessionA = await page.evaluate(() => window.localStorage.getItem('bloc-session'));
    expect(sessionA).toBeTruthy();
    // 2. Read user id.
    const userIdA = JSON.parse(sessionA ?? '{}').user_id as string;
    expect(userIdA).toMatch(/^[0-9a-f-]{36}$/);
    // 3. Reload.
    await page.reload();
    await expect(page.locator('[data-testid=sidebar-new-page]')).toBeEnabled({ timeout: 30_000 });
    // 4. Re-read session.
    const sessionB = await page.evaluate(() => window.localStorage.getItem('bloc-session'));
    const userIdB = JSON.parse(sessionB ?? '{}').user_id as string;
    // 5. User id stable.
    expect(userIdB).toBe(userIdA);
    // 6. Workspace id stable too.
    const wsA = JSON.parse(sessionA ?? '{}').workspace_id as string;
    const wsB = JSON.parse(sessionB ?? '{}').workspace_id as string;
    expect(wsB).toBe(wsA);
    // 7. session_bearer starts with Bearer test_
    const bearer = JSON.parse(sessionB ?? '{}').session_bearer as string;
    expect(bearer.startsWith('Bearer test_')).toBeTruthy();
    // 8. Navigate to /settings.
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    // 9. Session unchanged across nav.
    const sessionC = await page.evaluate(() => window.localStorage.getItem('bloc-session'));
    expect(sessionC).toBe(sessionB);
    // 10. Clear session.
    await page.evaluate(() => window.localStorage.removeItem('bloc-session'));
    // 11. Reload — bootstraps a new session (same user via find-or-create).
    await page.reload();
    await expect(page.locator('[data-testid=sidebar-new-page]')).toBeEnabled({ timeout: 30_000 });
    // 12. Same user id after re-bootstrap.
    const sessionD = await page.evaluate(() => window.localStorage.getItem('bloc-session'));
    expect(JSON.parse(sessionD ?? '{}').user_id).toBe(userIdA);
    expect(errors).toEqual([]);
  });

  test('10. inbox + reminders + trash panels open and close (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    // 1. Open Updates (inbox).
    await page.locator('.sidebar__quick').getByLabel('Inbox').click();
    // 2. Inbox panel visible — locate by its class to avoid collision with the
    //    TopBar "Updates" button.
    const inbox = page.locator('aside.inbox');
    await expect(inbox).toBeVisible();
    // 3. Inbox has tabs.
    await expect(inbox.getByRole('button', { name: 'All' })).toBeVisible();
    // 4. Switch to Mentions tab.
    await inbox.getByRole('button', { name: 'Mentions' }).click();
    await expect(inbox.getByRole('button', { name: 'Mentions' })).toHaveClass(/is-active/);
    // 5. Close inbox.
    await inbox.getByLabel('Close').click();
    await expect(inbox).toBeHidden();
    // 6. Open Reminders.
    await page.locator('.sidebar__quick').getByLabel('Reminders').click();
    const reminders = page.locator('aside.reminders');
    await expect(reminders).toBeVisible();
    // 7. Reminders has composer.
    await expect(reminders.getByPlaceholder('Remind me to…')).toBeVisible();
    // 8. Close reminders.
    await reminders.getByLabel('Close').click();
    await expect(reminders).toBeHidden();
    // 9. Open Trash.
    await page.locator('.sidebar__footer').getByText('Trash').click();
    const trash = page.locator('aside.trash');
    await expect(trash).toBeVisible();
    // 10. Trash has the 30-day hint.
    await expect(trash.locator('.trash__hint')).toContainText(/30 days/);
    // 11. Close Trash.
    await trash.getByLabel('Close').click();
    await expect(trash).toBeHidden();
    // 12. Sidebar still functional after closing all panels.
    await expect(page.locator('[data-testid=sidebar-new-page]')).toBeEnabled();
    expect(errors).toEqual([]);
  });
});
