import { expect, test } from '@playwright/test';
import { bootApp, createNewDatabase, failOnPageErrors, refreshSidebar } from './helpers.ts';

test.describe('database', () => {
  test('21. create database from launcher, see schema columns (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    // 1. Boot.
    await bootApp(page);
    // 2. Open /database.
    await page.goto('/database');
    // 3. Launcher visible.
    await expect(page.locator('[data-testid=database-launcher]')).toBeVisible();
    // 4. Database list shown.
    await expect(page.locator('[data-testid=database-list]')).toBeVisible();
    // 5. New database button enabled.
    const newBtn = page.locator('[data-testid=database-new]');
    await expect(newBtn).toBeEnabled();
    // 6. Click to create.
    await newBtn.click();
    // 7. Navigation to /database/:id.
    await page.waitForURL(/\/database\/[0-9a-f-]+/, { timeout: 60_000 });
    // 8. Editable database renders.
    await expect(page.locator('[data-testid=editable-database]')).toBeVisible({ timeout: 25_000 });
    // 9. Title visible.
    await expect(page.locator('[data-testid=db-title]')).toBeVisible();
    // 10. Name column header.
    await expect(page.locator('[data-testid="col-Name"]')).toBeVisible();
    // 11. Status column header.
    await expect(page.locator('[data-testid="col-Status"]')).toBeVisible();
    // 12. Due column header.
    await expect(page.locator('[data-testid="col-Due"]')).toBeVisible();
    // 13. Done column header.
    await expect(page.locator('[data-testid="col-Done"]')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('22. add three rows to a database (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    // 1. Create database.
    await createNewDatabase(page);
    // 2. There are no rows initially.
    await expect(page.getByText('No rows yet')).toBeVisible();
    // 3. Find add-row button.
    const addRow = page.locator('[data-testid=db-add-row]');
    await expect(addRow).toBeVisible();
    // 4. Click to add row 1.
    await addRow.click();
    // 5. Row count = 1.
    await expect(page.locator('[data-testid^="row-"]')).toHaveCount(1, { timeout: 15_000 });
    // 6. Click again for row 2.
    await addRow.click();
    await expect(page.locator('[data-testid^="row-"]')).toHaveCount(2, { timeout: 15_000 });
    // 7. Click again for row 3.
    await addRow.click();
    await expect(page.locator('[data-testid^="row-"]')).toHaveCount(3, { timeout: 15_000 });
    // 8. Each row has the default "New row" in the Name column.
    const titleInputs = page.locator('[data-testid^=cell-title-]');
    await expect(titleInputs).toHaveCount(3);
    await expect(titleInputs.first()).toHaveValue('New row');
    // 9. The "No rows yet" hint is gone.
    await expect(page.getByText('No rows yet')).toBeHidden();
    // 10. Reload — rows persist.
    await page.reload();
    await expect(page.locator('[data-testid=editable-database]')).toBeVisible({ timeout: 25_000 });
    await expect(page.locator('[data-testid^="row-"]')).toHaveCount(3, { timeout: 15_000 });
    // 11. Add one more.
    await page.locator('[data-testid=db-add-row]').click();
    await expect(page.locator('[data-testid^="row-"]')).toHaveCount(4, { timeout: 15_000 });
    // 12. There are now 4 title cells.
    await expect(page.locator('[data-testid^=cell-title-]')).toHaveCount(4);
    expect(errors).toEqual([]);
  });

  test('23. edit title cell and verify it persists (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    await createNewDatabase(page);
    // 1. Add a row.
    await page.locator('[data-testid=db-add-row]').click();
    await expect(page.locator('[data-testid^="row-"]')).toHaveCount(1);
    // 2. Find the title cell input.
    const titleInput = page.locator('[data-testid^=cell-title-]').first();
    await expect(titleInput).toBeVisible();
    // 3. Initial value is "New row".
    await expect(titleInput).toHaveValue('New row');
    // 4. Focus and clear.
    await titleInput.click();
    await titleInput.press('Control+a');
    await titleInput.press('Backspace');
    // 5. Type a new value.
    await titleInput.type('Buy milk');
    // 6. Value updated.
    await expect(titleInput).toHaveValue('Buy milk');
    // 7. Click outside to blur.
    await page.locator('[data-testid=db-title]').click();
    // 8. Wait a moment for the API call.
    await page.waitForTimeout(400);
    // 9. Reload.
    await page.reload();
    await expect(page.locator('[data-testid=editable-database]')).toBeVisible({ timeout: 25_000 });
    // 10. Title cell still has new value.
    const refreshed = page.locator('[data-testid^=cell-title-]').first();
    await expect(refreshed).toHaveValue('Buy milk');
    // 11. Edit again.
    await refreshed.click();
    await refreshed.press('Control+a');
    await refreshed.press('Backspace');
    await refreshed.type('Updated');
    // 12. Verify.
    await expect(refreshed).toHaveValue('Updated');
    expect(errors).toEqual([]);
  });

  test('24. toggle Done checkbox cell (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    await createNewDatabase(page);
    // 1. Add a row.
    await page.locator('[data-testid=db-add-row]').click();
    await expect(page.locator('[data-testid^="row-"]')).toHaveCount(1);
    // 2. Locate the checkbox cell (Done).
    const checkbox = page.locator('[data-testid^=cell-checkbox-]').first();
    await expect(checkbox).toBeVisible();
    // 3. Initial state is unchecked.
    await expect(checkbox).not.toBeChecked();
    // 4. Check it.
    await checkbox.check();
    await expect(checkbox).toBeChecked();
    // 5. Uncheck it.
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
    // 6. Check again.
    await checkbox.check();
    await expect(checkbox).toBeChecked();
    // 7. Wait for API.
    await page.waitForTimeout(400);
    // 8. Reload.
    await page.reload();
    await expect(page.locator('[data-testid=editable-database]')).toBeVisible({ timeout: 25_000 });
    // 9. Checkbox state persists.
    await expect(page.locator('[data-testid^=cell-checkbox-]').first()).toBeChecked();
    // 10. Uncheck after reload.
    await page.locator('[data-testid^=cell-checkbox-]').first().uncheck();
    await page.waitForTimeout(400);
    // 11. Reload again.
    await page.reload();
    await expect(page.locator('[data-testid=editable-database]')).toBeVisible({ timeout: 25_000 });
    // 12. Unchecked.
    await expect(page.locator('[data-testid^=cell-checkbox-]').first()).not.toBeChecked();
    expect(errors).toEqual([]);
  });

  test('25. edit status cell (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    await createNewDatabase(page);
    await page.locator('[data-testid=db-add-row]').click();
    // 1. Locate the status cell.
    const status = page.locator('[data-testid^=cell-status-]').first();
    await expect(status).toBeVisible();
    // 2. Initially empty.
    await expect(status).toHaveValue('');
    // 3. Focus and type.
    await status.click();
    await status.type('In progress');
    await expect(status).toHaveValue('In progress');
    // 4. Blur.
    await page.locator('[data-testid=db-title]').click();
    // 5. Wait for API.
    await page.waitForTimeout(400);
    // 6. Reload.
    await page.reload();
    await expect(page.locator('[data-testid=editable-database]')).toBeVisible({ timeout: 25_000 });
    // 7. Status persisted.
    await expect(page.locator('[data-testid^=cell-status-]').first()).toHaveValue('In progress');
    // 8. Clear value.
    const sb = page.locator('[data-testid^=cell-status-]').first();
    await sb.click();
    await sb.press('Control+a');
    await sb.press('Backspace');
    await expect(sb).toHaveValue('');
    // 9. Set to "Done".
    await sb.type('Done');
    await expect(sb).toHaveValue('Done');
    // 10. Blur + reload.
    await page.locator('[data-testid=db-title]').click();
    await page.waitForTimeout(400);
    await page.reload();
    // 11. Persisted Done.
    await expect(page.locator('[data-testid=editable-database]')).toBeVisible({ timeout: 25_000 });
    await expect(page.locator('[data-testid^=cell-status-]').first()).toHaveValue('Done');
    // 12. Add second row and ensure its status is independent (empty).
    await page.locator('[data-testid=db-add-row]').click();
    await expect(page.locator('[data-testid^=cell-status-]').nth(1)).toHaveValue('');
    expect(errors).toEqual([]);
  });

  test('26. edit date cell (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    await createNewDatabase(page);
    await page.locator('[data-testid=db-add-row]').click();
    // 1. Locate date input.
    const date = page.locator('[data-testid^=cell-date-]').first();
    await expect(date).toBeVisible();
    // 2. Initially empty.
    await expect(date).toHaveValue('');
    // 3. Set a date.
    await date.fill('2026-06-15');
    await expect(date).toHaveValue('2026-06-15');
    // 4. Blur + wait.
    await page.locator('[data-testid=db-title]').click();
    await page.waitForTimeout(400);
    // 5. Reload.
    await page.reload();
    await expect(page.locator('[data-testid=editable-database]')).toBeVisible({ timeout: 25_000 });
    // 6. Date persists.
    await expect(page.locator('[data-testid^=cell-date-]').first()).toHaveValue('2026-06-15');
    // 7. Change it.
    const date2 = page.locator('[data-testid^=cell-date-]').first();
    await date2.fill('2026-07-04');
    await expect(date2).toHaveValue('2026-07-04');
    // 8. Blur.
    await page.locator('[data-testid=db-title]').click();
    await page.waitForTimeout(400);
    // 9. Reload.
    await page.reload();
    await expect(page.locator('[data-testid=editable-database]')).toBeVisible({ timeout: 25_000 });
    // 10. Persisted.
    await expect(page.locator('[data-testid^=cell-date-]').first()).toHaveValue('2026-07-04');
    // 11. Clear it.
    const date3 = page.locator('[data-testid^=cell-date-]').first();
    await date3.fill('');
    // 12. Blur — empty persists.
    await page.locator('[data-testid=db-title]').click();
    await expect(date3).toHaveValue('');
    expect(errors).toEqual([]);
  });

  test('27. switch through all six database views (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    await createNewDatabase(page);
    await page.locator('[data-testid=db-add-row]').click();
    await expect(page.locator('[data-testid^="row-"]')).toHaveCount(1);
    // 1. Table view active by default.
    await expect(page.locator('[data-testid=view-table]')).toHaveClass(/is-active/);
    // 2. Switch to Board.
    await page.locator('[data-testid=view-board]').click();
    await expect(page.locator('[data-testid=view-board]')).toHaveClass(/is-active/);
    await expect(page.locator('.boardview')).toBeVisible();
    // 3. Switch to Gallery.
    await page.locator('[data-testid=view-gallery]').click();
    await expect(page.locator('[data-testid=view-gallery]')).toHaveClass(/is-active/);
    await expect(page.locator('.galleryview')).toBeVisible();
    // 4. Switch to List.
    await page.locator('[data-testid=view-list]').click();
    await expect(page.locator('[data-testid=view-list]')).toHaveClass(/is-active/);
    await expect(page.locator('.listview').first()).toBeVisible();
    // 5. Switch to Calendar.
    await page.locator('[data-testid=view-calendar]').click();
    await expect(page.locator('[data-testid=view-calendar]')).toHaveClass(/is-active/);
    await expect(page.locator('.calview')).toBeVisible();
    // 6. Switch to Timeline.
    await page.locator('[data-testid=view-timeline]').click();
    await expect(page.locator('[data-testid=view-timeline]')).toHaveClass(/is-active/);
    // Timeline shows "No dated rows" when empty — that's expected.
    // 7. Set a date on the row so timeline has content.
    await page.locator('[data-testid=view-table]').click();
    await page.locator('[data-testid^=cell-date-]').first().fill('2026-06-01');
    await page.locator('[data-testid=db-title]').click();
    await page.waitForTimeout(400);
    // 8. Switch back to Timeline and expect content.
    await page.locator('[data-testid=view-timeline]').click();
    await expect(page.locator('.timelineview, .dbview__empty')).toBeVisible();
    // 9. Switch back to Table.
    await page.locator('[data-testid=view-table]').click();
    await expect(page.locator('[data-testid=view-table]')).toHaveClass(/is-active/);
    // 10. Add another row.
    await page.locator('[data-testid=db-add-row]').click();
    await expect(page.locator('[data-testid^="row-"]')).toHaveCount(2);
    // 11. Switch to Board — count badges should reflect.
    await page.locator('[data-testid=view-board]').click();
    await expect(page.locator('.boardview__col')).toHaveCount(1, { timeout: 5000 });
    // 12. Switch to Gallery.
    await page.locator('[data-testid=view-gallery]').click();
    await expect(page.locator('.galleryview__card')).toHaveCount(2);
    expect(errors).toEqual([]);
  });

  test('28. database title is shown and database list shows the created entry (≥10 steps)', async ({
    page,
  }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    // 1. Create a database.
    const dbId = await createNewDatabase(page);
    // 2. Title is "New database".
    await expect(page.locator('[data-testid=db-title]')).toContainText('New database');
    // 3. Navigate back to launcher.
    await page.goto('/database');
    await expect(page.locator('[data-testid=database-launcher]')).toBeVisible();
    // 4. The created db is in the list.
    await expect(page.locator(`[data-testid="db-${dbId}"]`)).toBeVisible({ timeout: 15_000 });
    // 5. Click it.
    await page.locator(`[data-testid="db-${dbId}"]`).click();
    // 6. Navigates to /database/:id.
    await page.waitForURL(`/database/${dbId}`);
    await expect(page.locator('[data-testid=editable-database]')).toBeVisible({ timeout: 25_000 });
    // 7. Back to launcher.
    await page.goto('/database');
    // 8. Create another.
    await page.locator('[data-testid=database-new]').click();
    await page.waitForURL(/\/database\/[0-9a-f-]+/);
    const dbId2 = page.url().split('/database/')[1] ?? '';
    expect(dbId2).not.toBe(dbId);
    // 9. Back to launcher.
    await page.goto('/database');
    await expect(page.locator('[data-testid=database-launcher]')).toBeVisible();
    // 10. Both databases listed.
    await expect(page.locator(`[data-testid="db-${dbId}"]`)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(`[data-testid="db-${dbId2}"]`)).toBeVisible({ timeout: 10_000 });
    // 11. Hover and click first.
    await page.locator(`[data-testid="db-${dbId}"]`).click();
    await page.waitForURL(`/database/${dbId}`);
    // 12. Editable database renders again.
    await expect(page.locator('[data-testid=editable-database]')).toBeVisible({ timeout: 25_000 });
    expect(errors).toEqual([]);
  });

  test('29. database in sidebar (Private section) shows ⌗ icon for databases (≥10 steps)', async ({
    page,
  }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    // 1. Create db.
    const dbId = await createNewDatabase(page);
    // 2. Go home.
    await page.goto('/');
    await expect(page.locator('[data-testid=sidebar-new-page]')).toBeEnabled();
    // 2b. Sidebar persists across (workspace) navigations without remounting;
    // dispatch the cross-component refresh event so it re-fetches.
    await refreshSidebar(page);
    // 3. Sidebar has Private section.
    await expect(page.locator('.sidebar__section').getByText('Private')).toBeVisible();
    // 4. The new db is in the Private section (or at least somewhere in the sidebar).
    const sidebarItem = page.locator(`[data-testid="sidebar-page-${dbId}"]`);
    await expect(sidebarItem).toBeVisible({ timeout: 15_000 });
    // 5. The icon is the database glyph "⌗" since no emoji was set.
    const icon = sidebarItem.locator('.sidebar__page-icon');
    await expect(icon).toHaveText('⌗');
    // 6. Click the link.
    await sidebarItem.click();
    // 7. Navigates to /database/:id.
    await page.waitForURL(`/database/${dbId}`);
    // 8. Editable database renders.
    await expect(page.locator('[data-testid=editable-database]')).toBeVisible({ timeout: 25_000 });
    // 9. Back home.
    await page.goto('/');
    await refreshSidebar(page);
    // 10. Sidebar still shows the entry.
    await expect(page.locator(`[data-testid="sidebar-page-${dbId}"]`)).toBeVisible({
      timeout: 10_000,
    });
    // 11. Create another page (not db).
    const pageId = await page
      .locator('[data-testid=sidebar-new-page]')
      .click()
      .then(async () => {
        await page.waitForURL(/\/page\/[0-9a-f-]+/);
        return page.url().split('/page/')[1] ?? '';
      });
    await page.goto('/');
    await refreshSidebar(page);
    // 12. The page entry shows the 📄 icon (default emoji set on creation).
    const pageIcon = page
      .locator(`[data-testid="sidebar-page-${pageId}"] .sidebar__page-icon`);
    await expect(pageIcon).toBeVisible({ timeout: 10_000 });
    expect(errors).toEqual([]);
  });

  test('30. database — multi-row workflow with mixed cell edits (≥10 steps)', async ({
    page,
  }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    await createNewDatabase(page);
    // 1. Add 3 rows.
    for (let i = 0; i < 3; i++) {
      await page.locator('[data-testid=db-add-row]').click();
    }
    await expect(page.locator('[data-testid^="row-"]')).toHaveCount(3);
    // 2. Edit title of row 0.
    const titles = page.locator('[data-testid^=cell-title-]');
    await titles.nth(0).click();
    await titles.nth(0).press('Control+a');
    await titles.nth(0).press('Backspace');
    await titles.nth(0).type('Task A');
    // 3. Edit title of row 1.
    await titles.nth(1).click();
    await titles.nth(1).press('Control+a');
    await titles.nth(1).press('Backspace');
    await titles.nth(1).type('Task B');
    // 4. Edit title of row 2.
    await titles.nth(2).click();
    await titles.nth(2).press('Control+a');
    await titles.nth(2).press('Backspace');
    await titles.nth(2).type('Task C');
    // 5. Set status of row 0.
    const statuses = page.locator('[data-testid^=cell-status-]');
    await statuses.nth(0).click();
    await statuses.nth(0).type('To-do');
    // 6. Set status of row 1.
    await statuses.nth(1).click();
    await statuses.nth(1).type('In progress');
    // 7. Set status of row 2 to Done.
    await statuses.nth(2).click();
    await statuses.nth(2).type('Done');
    // 8. Check row 2's Done.
    const checks = page.locator('[data-testid^=cell-checkbox-]');
    await checks.nth(2).check();
    // 9. Set date on row 1.
    const dates = page.locator('[data-testid^=cell-date-]');
    await dates.nth(1).fill('2026-08-01');
    // 10. Blur + wait.
    await page.locator('[data-testid=db-title]').click();
    await page.waitForTimeout(800);
    // 11. Reload.
    await page.reload();
    await expect(page.locator('[data-testid=editable-database]')).toBeVisible({ timeout: 25_000 });
    // 12. Assertions on row count and titles.
    await expect(page.locator('[data-testid^="row-"]')).toHaveCount(3, { timeout: 15_000 });
    await expect(page.locator('[data-testid^=cell-title-]').nth(0)).toHaveValue('Task A');
    await expect(page.locator('[data-testid^=cell-title-]').nth(1)).toHaveValue('Task B');
    await expect(page.locator('[data-testid^=cell-title-]').nth(2)).toHaveValue('Task C');
    // 13. Status persists.
    await expect(page.locator('[data-testid^=cell-status-]').nth(2)).toHaveValue('Done');
    expect(errors).toEqual([]);
  });
});