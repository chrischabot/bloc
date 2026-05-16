import { expect, test } from '@playwright/test';

test.describe('frontend smoke', () => {
  test('home page renders', async ({ page }) => {
    await page.goto('/');
    // `/` redirects to `/home` which renders the Home heading.
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible({ timeout: 15_000 });
  });

  test('sidebar is navigable', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('aside.sidebar')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.sidebar__section').getByText('Private')).toBeVisible();
  });

  test('editor playground shows block types and toolbar', async ({ page }) => {
    await page.goto('/editor');
    await expect(page.getByRole('heading', { name: 'Block playground' })).toBeVisible();
    await expect(page.getByRole('toolbar', { name: 'Text formatting' })).toBeVisible();
  });

  test('database launcher renders create button + list', async ({ page }) => {
    await page.goto('/database');
    await expect(page.locator('[data-testid=database-launcher]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid=database-new]')).toBeEnabled({ timeout: 15_000 });
  });

  test('settings page renders sections', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByText('My account')).toBeVisible();
  });

  test('share dialog opens on click', async ({ page }) => {
    await page.goto('/');
    await page.locator('.topbar').getByRole('button', { name: 'Share' }).click();
    await expect(page.getByRole('dialog', { name: 'Share' })).toBeVisible();
  });
});