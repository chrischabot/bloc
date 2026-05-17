import { type Locator, type Page, expect } from '@playwright/test';

const BOOT_TIMEOUT = 30_000;
const ROUTE_TIMEOUT = 30_000;
const DB_CREATE_TIMEOUT = 60_000;

/** Stable sidebar selector that avoids `getByLabel('Sidebar')` substring matches. */
export function sidebar(page: Page): Locator {
  return page.locator('aside.sidebar');
}

/** Navigate to home and wait for the sidebar to be ready (bootstrap complete). */
export async function bootApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-testid=sidebar-new-page]')).toBeEnabled({
    timeout: BOOT_TIMEOUT,
  });
}

/** Click the sidebar "New page" button, wait for /page/[id] and the editor. */
export async function createNewPage(page: Page): Promise<string> {
  await expect(page.locator('[data-testid=sidebar-new-page]')).toBeEnabled({
    timeout: BOOT_TIMEOUT,
  });
  const beforeUrl = page.url();
  await page.locator('[data-testid=sidebar-new-page]').click();
  await page.waitForFunction(
    (before: string) =>
      /\/page\/[0-9a-f-]{36}(?:[/?#]|$)/.test(window.location.href) &&
      window.location.href !== before,
    beforeUrl,
    { timeout: ROUTE_TIMEOUT },
  );
  await expect(page.locator('[data-testid=editable-page]')).toBeVisible({
    timeout: BOOT_TIMEOUT,
  });
  // Wait for at least one block to render.
  await expect(page.locator('[data-block-id]').first()).toBeVisible({ timeout: BOOT_TIMEOUT });
  const match = page.url().match(/\/page\/([0-9a-f-]{36})/);
  return match?.[1] ?? '';
}

/** Open /database, click "+ New database", return the new id. */
export async function createNewDatabase(page: Page): Promise<string> {
  await page.goto('/database');
  await expect(page.locator('[data-testid=database-launcher]')).toBeVisible({
    timeout: BOOT_TIMEOUT,
  });
  await expect(page.locator('[data-testid=database-new]')).toBeEnabled({ timeout: BOOT_TIMEOUT });
  const beforeUrl = page.url();
  await page.locator('[data-testid=database-new]').click();
  await page.waitForFunction(
    (before: string) =>
      /\/database\/[0-9a-f-]{36}(?:[/?#]|$)/.test(window.location.href) &&
      window.location.href !== before,
    beforeUrl,
    { timeout: DB_CREATE_TIMEOUT },
  );
  await expect(page.locator('[data-testid=editable-database]')).toBeVisible({
    timeout: BOOT_TIMEOUT,
  });
  const match = page.url().match(/\/database\/([0-9a-f-]{36})/);
  return match?.[1] ?? '';
}

/** Get the contenteditable inside the Nth block row. */
export function blockEditableAt(page: Page, idx: number): Locator {
  return page.locator('[data-block-id]').nth(idx).locator('[role=textbox]');
}

/** Get the data-block-id of the Nth block row. */
export async function blockIdAt(page: Page, idx: number): Promise<string> {
  const id = await page.locator('[data-block-id]').nth(idx).getAttribute('data-block-id');
  return id ?? '';
}

/** Get the data-block-type of the Nth block row. */
export async function blockTypeAt(page: Page, idx: number): Promise<string> {
  const t = await page.locator('[data-block-id]').nth(idx).getAttribute('data-block-type');
  return t ?? '';
}

/** Total block count on the page. */
export function blockCount(page: Page): Promise<number> {
  return page.locator('[data-block-id]').count();
}

/** Install a pageerror listener that pushes uncaught errors into the returned array. */
export function failOnPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => {
    errors.push(`${err.name}: ${err.message}`);
  });
  return errors;
}

/** Wait for the editor's debounced save (350ms in EditablePage) plus a generous buffer. */
export async function waitForDebouncedSave(page: Page): Promise<void> {
  await page.waitForTimeout(1000);
}

/**
 * Dispatch the cross-component sidebar refresh event so tests can force a
 * Sidebar re-fetch when navigating intra-workspace (where Sidebar persists
 * across page transitions without remounting).
 */
export async function refreshSidebar(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(new Event('bloc:sidebar:refresh'));
  });
}

/** Type text into a contenteditable element by setting textContent + firing input. */
export async function typeIntoBlock(block: Locator, text: string): Promise<void> {
  await block.click();
  await block.evaluate((el, value) => {
    (el as HTMLElement).textContent = value;
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }, text);
}

/** Change the Nth block's type using its visible <select> element. */
export async function changeBlockType(page: Page, idx: number, nextType: string): Promise<void> {
  const id = await blockIdAt(page, idx);
  await page.locator(`[data-testid="type-${id}"]`).selectOption(nextType);
  // Block-type change is a delete-and-insert dance; wait for the resulting
  // block at this index to report the new type.
  await expect(page.locator(`[data-block-type="${nextType}"]`).first()).toBeVisible({
    timeout: 15_000,
  });
}

/** Unique suffix for test data so concurrent / repeated runs don't collide. */
export function uniqueSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}
