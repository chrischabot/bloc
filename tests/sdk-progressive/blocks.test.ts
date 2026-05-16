import { type TestHarness, bootTestHarness, closeHarness } from '@bloc/api/test-helpers';
import { Bloc } from '@bloc/sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { unblocked } from './matrix.ts';

let h: TestHarness;

beforeEach(async () => {
  h = await bootTestHarness();
});
afterEach(async () => {
  await closeHarness(h);
});

const BASE = 'http://test.local';

function makeClient(): Bloc {
  return new Bloc({
    auth: h.bearer,
    baseUrl: BASE,
    fetch: async (input, init) =>
      h.app.request(typeof input === 'string' ? input : input.toString(), init ?? {}),
  });
}

describe('SDK-progressive: blocks', () => {
  it.skipIf(!unblocked['blocks.children.append'])('blocks.children.append', async () => {
    const client = makeClient();
    const res = await client.blocks.children.append({
      block_id: h.page.id,
      children: [
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: 'sdk', link: null } }],
            color: 'default',
          },
        },
      ],
    });
    expect(res.object).toBe('list');
    expect(res.results).toHaveLength(1);
    expect(res.results[0]!.type).toBe('paragraph');
  });

  it.skipIf(!unblocked['blocks.children.list'])('blocks.children.list paginates', async () => {
    const client = makeClient();
    await client.blocks.children.append({
      block_id: h.page.id,
      children: Array.from({ length: 4 }, () => ({
        type: 'paragraph',
        paragraph: { rich_text: [], color: 'default' },
      })),
    });
    const page1 = await client.blocks.children.list({ block_id: h.page.id, page_size: 2 });
    expect(page1.results).toHaveLength(2);
    expect(page1.has_more).toBe(true);
    expect(page1.next_cursor).not.toBeNull();
  });

  it.skipIf(!unblocked['blocks.retrieve'])('blocks.retrieve returns the block', async () => {
    const client = makeClient();
    const appended = await client.blocks.children.append({
      block_id: h.page.id,
      children: [{ type: 'paragraph', paragraph: { rich_text: [], color: 'default' } }],
    });
    const block = await client.blocks.retrieve({ block_id: appended.results[0]!.id });
    expect(block.object).toBe('block');
    expect(block.type).toBe('paragraph');
  });

  it.skipIf(!unblocked['blocks.update'])('blocks.update mutates payload', async () => {
    const client = makeClient();
    const appended = await client.blocks.children.append({
      block_id: h.page.id,
      children: [{ type: 'paragraph', paragraph: { rich_text: [], color: 'default' } }],
    });
    const updated = await client.blocks.update({
      block_id: appended.results[0]!.id,
      paragraph: {
        rich_text: [{ type: 'text', text: { content: 'updated', link: null } }],
        color: 'blue',
      },
    });
    const block = updated as unknown as { paragraph: { color: string } };
    expect(block.paragraph.color).toBe('blue');
  });

  it.skipIf(!unblocked['blocks.delete'])('blocks.delete archives', async () => {
    const client = makeClient();
    const appended = await client.blocks.children.append({
      block_id: h.page.id,
      children: [{ type: 'paragraph', paragraph: { rich_text: [], color: 'default' } }],
    });
    const archived = await client.blocks.delete({ block_id: appended.results[0]!.id });
    expect((archived as unknown as { archived: boolean }).archived).toBe(true);
  });
});
