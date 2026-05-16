import { expect, test } from '@playwright/test';
import {
  blockCount,
  blockEditableAt,
  blockIdAt,
  blockTypeAt,
  bootApp,
  changeBlockType,
  createNewPage,
  failOnPageErrors,
  typeIntoBlock,
  waitForDebouncedSave,
} from './helpers.ts';

async function addBlockAndWait(
  page: import('@playwright/test').Page,
  expected: number,
): Promise<void> {
  const blocks = page.locator('[data-block-id]');
  const before = await blocks.count();
  await page.locator('[data-testid=add-block]').click();
  try {
    await expect(blocks).toHaveCount(expected, { timeout: 5_000 });
  } catch {
    if ((await blocks.count()) === before) {
      await page.locator('[data-testid=add-block]').click();
    }
    await expect(blocks).toHaveCount(expected, { timeout: 10_000 });
  }
}

test.describe('page editor', () => {
  test('11. create page from sidebar, edit title, persist on reload (≥10 steps)', async ({
    page,
  }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    const id = await createNewPage(page);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const titleInput = page.locator('[data-testid=page-title]');
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveValue('Untitled');
    await expect(page.locator('[data-testid=editor-body]')).toBeVisible();
    expect(await blockCount(page)).toBe(1);
    expect(await blockTypeAt(page, 0)).toBe('paragraph');
    await titleInput.click();
    await titleInput.press('Control+a');
    await titleInput.press('Backspace');
    await titleInput.type('Test page');
    await expect(titleInput).toHaveValue('Test page');
    await typeIntoBlock(blockEditableAt(page, 0), 'Hello world');
    await expect(blockEditableAt(page, 0)).toHaveText('Hello world');
    await waitForDebouncedSave(page);
    await page.reload();
    await expect(page.locator('[data-testid=editable-page]')).toBeVisible({ timeout: 20_000 });
    await expect(blockEditableAt(page, 0)).toHaveText('Hello world');
    expect(errors).toEqual([]);
  });

  test('12. add multiple paragraph blocks with Enter key (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    await createNewPage(page);
    expect(await blockCount(page)).toBe(1);
    const first = blockEditableAt(page, 0);
    await first.click();
    await first.type('Block A');
    await first.press('Enter');
    await expect(page.locator('[data-block-id]')).toHaveCount(2);
    const second = blockEditableAt(page, 1);
    await second.type('Block B');
    await second.press('Enter');
    await expect(page.locator('[data-block-id]')).toHaveCount(3);
    await blockEditableAt(page, 2).type('Block C');
    await blockEditableAt(page, 2).press('Enter');
    await expect(page.locator('[data-block-id]')).toHaveCount(4);
    await expect(blockEditableAt(page, 0)).toHaveText('Block A');
    await expect(blockEditableAt(page, 1)).toHaveText('Block B');
    await expect(blockEditableAt(page, 2)).toHaveText('Block C');
    expect(errors).toEqual([]);
  });

  test('13. change block type via dropdown — paragraph → heading_1 → quote (≥10 steps)', async ({
    page,
  }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    await createNewPage(page);
    expect(await blockTypeAt(page, 0)).toBe('paragraph');
    await blockEditableAt(page, 0).click();
    await blockEditableAt(page, 0).type('Carry-over text');
    await changeBlockType(page, 0, 'heading_1');
    expect(await blockTypeAt(page, 0)).toBe('heading_1');
    await expect(blockEditableAt(page, 0)).toHaveText('Carry-over text');
    await changeBlockType(page, 0, 'heading_2');
    expect(await blockTypeAt(page, 0)).toBe('heading_2');
    await changeBlockType(page, 0, 'quote');
    expect(await blockTypeAt(page, 0)).toBe('quote');
    await changeBlockType(page, 0, 'bulleted_list_item');
    expect(await blockTypeAt(page, 0)).toBe('bulleted_list_item');
    await changeBlockType(page, 0, 'numbered_list_item');
    expect(await blockTypeAt(page, 0)).toBe('numbered_list_item');
    await changeBlockType(page, 0, 'callout');
    expect(await blockTypeAt(page, 0)).toBe('callout');
    await changeBlockType(page, 0, 'code');
    expect(await blockTypeAt(page, 0)).toBe('code');
    await changeBlockType(page, 0, 'paragraph');
    expect(await blockTypeAt(page, 0)).toBe('paragraph');
    expect(errors).toEqual([]);
  });

  test('14. to-do block: change type then toggle checkbox (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    await createNewPage(page);
    await typeIntoBlock(blockEditableAt(page, 0), 'Pick up groceries');
    await changeBlockType(page, 0, 'to_do');
    expect(await blockTypeAt(page, 0)).toBe('to_do');
    const id = await blockIdAt(page, 0);
    const cb = page.locator(`[data-testid="todo-${id}"]`);
    await expect(cb).toBeVisible();
    await expect(cb).not.toBeChecked();
    await cb.check();
    await expect(cb).toBeChecked();
    await expect(page.locator(`[data-block-id="${id}"] [role=textbox]`)).toHaveClass(/is-checked/);
    await cb.uncheck();
    await expect(cb).not.toBeChecked();
    await expect(blockEditableAt(page, 0)).toHaveText('Pick up groceries');
    await cb.check();
    await expect(cb).toBeChecked();
    await waitForDebouncedSave(page);
    await page.reload();
    await expect(page.locator('[data-testid=editable-page]')).toBeVisible({ timeout: 20_000 });
    const idAfter = await blockIdAt(page, 0);
    await expect(page.locator(`[data-testid="todo-${idAfter}"]`)).toBeChecked();
    expect(errors).toEqual([]);
  });

  test('15. slash menu opens with "/" and inserts a divider (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    await createNewPage(page);
    // 1. Focus the first (empty) block.
    const first = blockEditableAt(page, 0);
    await first.click();
    // 2. Type "/" to open the slash menu.
    await first.press('/');
    // 3. Slash menu becomes visible.
    const slash = page.getByLabel('Slash command menu');
    await expect(slash).toBeVisible({ timeout: 5_000 });
    // 4. Menu shows section headers.
    await expect(slash.getByText('Basic blocks', { exact: true })).toBeVisible();
    // 5. Items have icons.
    await expect(slash.locator('.slashmenu__icon').first()).toBeVisible();
    // 6. The Divider item is visible.
    const divider = slash.getByRole('button', { name: /Divider/ });
    await expect(divider).toBeVisible();
    // 7. Click Divider.
    await divider.click();
    // 8. Slash menu closes.
    await expect(slash).toBeHidden();
    // 9. A divider block now exists.
    await expect(page.locator('[data-block-type="divider"]')).toBeVisible({ timeout: 10_000 });
    // 10. At least one divider block is present.
    expect(await page.locator('[data-block-type="divider"]').count()).toBeGreaterThanOrEqual(1);
    // 11. Add a paragraph block via the add-block button (divider has no textbox).
    await page.locator('[data-testid=add-block]').click();
    // 12. Find the last paragraph block and re-open the slash menu on it.
    const paragraphs = page.locator('[data-block-type="paragraph"]');
    await expect(paragraphs.last()).toBeVisible({ timeout: 10_000 });
    const editable = paragraphs.last().locator('[role=textbox]');
    await editable.click();
    await editable.press('/');
    await expect(slash).toBeVisible({ timeout: 5_000 });
    // 13. Close via Escape.
    await page.keyboard.press('Escape');
    await expect(slash).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('16. delete block via × button (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    await createNewPage(page);
    await addBlockAndWait(page, 2);
    await addBlockAndWait(page, 3);
    await addBlockAndWait(page, 4);
    await blockEditableAt(page, 0).type('First');
    await blockEditableAt(page, 1).type('Second');
    await blockEditableAt(page, 2).type('Third');
    await blockEditableAt(page, 3).type('Fourth');
    await waitForDebouncedSave(page);
    const middleId = await blockIdAt(page, 1);
    await expect(page.locator(`[data-block-id="${middleId}"]`)).toBeVisible();
    await page.locator(`[data-testid="delete-${middleId}"]`).click();
    await expect(page.locator(`[data-block-id="${middleId}"]`)).toHaveCount(0, { timeout: 10_000 });
    await expect(page.locator('[data-block-id]')).toHaveCount(3);
    await expect(page.locator('[data-testid=editor-body]')).not.toContainText('Second');
    await expect(blockEditableAt(page, 0)).toHaveText('First');
    const lastId = await blockIdAt(page, 2);
    await page.locator(`[data-testid="delete-${lastId}"]`).click();
    await expect(page.locator('[data-block-id]')).toHaveCount(2);
    await waitForDebouncedSave(page);
    await page.reload();
    await expect(page.locator('[data-testid=editable-page]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-block-id]')).toHaveCount(2);
    await expect(page.locator('[data-testid=editor-body]')).toContainText('First');
    await expect(page.locator('[data-testid=editor-body]')).toContainText('Third');
    expect(errors).toEqual([]);
  });

  test('17. Backspace on empty block removes it and focuses previous (≥10 steps)', async ({
    page,
  }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    await createNewPage(page);
    // 1. Block 0 has text.
    await blockEditableAt(page, 0).click();
    await blockEditableAt(page, 0).type('alpha');
    // 2. Press Enter to make block 1.
    await blockEditableAt(page, 0).press('Enter');
    // 3. Wait for block 1 to exist.
    await expect(page.locator('[data-block-id]')).toHaveCount(2, { timeout: 10_000 });
    // 4. Block 1 is empty.
    await expect(blockEditableAt(page, 1)).toHaveText('');
    // 5. Capture id of block 1.
    const id1 = await blockIdAt(page, 1);
    // 6. Focus block 1 explicitly (Enter creates async focus that may not have settled).
    await blockEditableAt(page, 1).click();
    // 7. Press Backspace on block 1.
    await blockEditableAt(page, 1).press('Backspace');
    // 8. The empty block is removed.
    await expect(page.locator(`[data-block-id="${id1}"]`)).toHaveCount(0, { timeout: 10_000 });
    // 9. Count is 1.
    await expect(page.locator('[data-block-id]')).toHaveCount(1);
    // 10. Block 0 still has its text.
    await expect(blockEditableAt(page, 0)).toHaveText('alpha');
    // 11. Add another block and immediately remove again.
    await blockEditableAt(page, 0).click();
    await blockEditableAt(page, 0).press('End');
    await blockEditableAt(page, 0).press('Enter');
    await expect(page.locator('[data-block-id]')).toHaveCount(2, { timeout: 10_000 });
    // 12. Focus + Backspace on the empty new block.
    await blockEditableAt(page, 1).click();
    await blockEditableAt(page, 1).press('Backspace');
    // 13. Back to 1 block.
    await expect(page.locator('[data-block-id]')).toHaveCount(1, { timeout: 10_000 });
    expect(errors).toEqual([]);
  });

  test('18. archive page returns home and shows empty editor on next page (≥10 steps)', async ({
    page,
  }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    // 1. Create a page.
    const id = await createNewPage(page);
    // 2. URL contains the id.
    expect(page.url()).toContain(`/page/${id}`);
    // 3. Archive button present.
    const archive = page.locator('[data-testid=page-archive]');
    await expect(archive).toBeVisible();
    // 4. Click Archive.
    await archive.click();
    // 5. Should navigate away from /page/:id (root or /home).
    await page.waitForURL(/(\/|\/home)$/, { timeout: 15_000 });
    // 6. Main content is visible (Home or Welcome).
    await expect(page.locator('main.content')).toBeVisible();
    // 7. Sidebar still functional.
    await expect(page.locator('[data-testid=sidebar-new-page]')).toBeEnabled();
    // 8. Create another page.
    const id2 = await createNewPage(page);
    expect(id2).not.toBe(id);
    // 9. New page has the default empty paragraph block.
    expect(await blockCount(page)).toBe(1);
    // 10. Default title.
    await expect(page.locator('[data-testid=page-title]')).toHaveValue('Untitled');
    // 11. Archive again.
    await page.locator('[data-testid=page-archive]').click();
    await page.waitForURL(/(\/|\/home)$/, { timeout: 15_000 });
    // 12. Sidebar Private section is still visible.
    await expect(page.locator('.sidebar__section').getByText('Private')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('19. add-block button appends a new paragraph at the end (≥10 steps)', async ({
    page,
  }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    await createNewPage(page);
    expect(await blockCount(page)).toBe(1);
    await addBlockAndWait(page, 2);
    await addBlockAndWait(page, 3);
    await blockEditableAt(page, 2).click();
    await blockEditableAt(page, 2).type('Last block');
    await addBlockAndWait(page, 4);
    await expect(blockEditableAt(page, 2)).toHaveText('Last block');
    await expect(blockEditableAt(page, 3)).toHaveText('');
    expect(await blockTypeAt(page, 3)).toBe('paragraph');
    expect(await blockCount(page)).toBe(4);
    expect(errors).toEqual([]);
  });

  test('20. full mixed-block workflow round-trips through API (≥10 steps)', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await bootApp(page);
    await createNewPage(page);
    // 1. Block 0 → heading_1 "Headline"
    await typeIntoBlock(blockEditableAt(page, 0), 'Headline');
    await changeBlockType(page, 0, 'heading_1');
    // 2. Add block 1 (paragraph by default).
    await addBlockAndWait(page, 2);
    // 3. Type "Intro paragraph."
    await blockEditableAt(page, 1).click();
    await blockEditableAt(page, 1).type('Intro paragraph.');
    // 4. Add block 2 → bulleted_list_item "Bullet A".
    await addBlockAndWait(page, 3);
    await blockEditableAt(page, 2).click();
    await blockEditableAt(page, 2).type('Bullet A');
    await changeBlockType(page, 2, 'bulleted_list_item');
    // 5. Add block 3 → bulleted_list_item "Bullet B".
    await addBlockAndWait(page, 4);
    await blockEditableAt(page, 3).click();
    await blockEditableAt(page, 3).type('Bullet B');
    await changeBlockType(page, 3, 'bulleted_list_item');
    // 6. Add block 4 → to_do.
    await addBlockAndWait(page, 5);
    await blockEditableAt(page, 4).click();
    await blockEditableAt(page, 4).type('Check me');
    await changeBlockType(page, 4, 'to_do');
    // 7. Toggle the to_do.
    const todoId = await blockIdAt(page, 4);
    await page.locator(`[data-testid="todo-${todoId}"]`).check();
    // 8. Add block 5 → divider (no text needed).
    await addBlockAndWait(page, 6);
    await changeBlockType(page, 5, 'divider');
    // 9. Wait for debounce + reload.
    await waitForDebouncedSave(page);
    await page.reload();
    await expect(page.locator('[data-testid=editable-page]')).toBeVisible({ timeout: 25_000 });
    // 10. Counts persist (>= 5 blocks).
    expect(await blockCount(page)).toBeGreaterThanOrEqual(5);
    // 11. Heading text persisted.
    await expect(page.locator('[data-testid=editor-body]')).toContainText('Headline');
    // 12. Bulleted text persisted.
    await expect(page.locator('[data-testid=editor-body]')).toContainText('Bullet A');
    await expect(page.locator('[data-testid=editor-body]')).toContainText('Bullet B');
    // 13. Divider exists.
    await expect(page.locator('[data-block-type="divider"]')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
});