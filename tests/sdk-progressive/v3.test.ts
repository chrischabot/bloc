import { type TestHarness, bootTestHarness, closeHarness } from '@bloc/api/test-helpers';
import { appendChildren } from '@bloc/db';
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

describe('SDK-progressive: v3 internal surface', () => {
  it.skipIf(!unblocked['v3.loadPageChunk'])('loadPageChunk returns recordMap', async () => {
    const client = makeClient();
    const result = await client.v3.loadPageChunk({ pageId: h.page.id });
    expect(result.recordMap).toBeDefined();
  });

  it.skipIf(!unblocked['v3.getRecordValues'])('getRecordValues fetches blocks', async () => {
    const [block] = await appendChildren(h.handle.db, {
      workspaceId: h.workspaceId,
      parentType: 'page',
      parentId: h.page.id,
      actor: h.userId,
      children: [
        { type: 'paragraph', content: { paragraph: { rich_text: [], color: 'default' } } },
      ],
    });
    const client = makeClient();
    const res = await client.v3.getRecordValues({
      requests: [{ table: 'block', id: block!.id }],
    });
    expect(res.results[0]).not.toBeNull();
    expect(res.results[0]!.value['id']).toBe(block!.id);
  });

  it.skipIf(!unblocked['v3.submitTransaction'])('submitTransaction archives a block', async () => {
    const [block] = await appendChildren(h.handle.db, {
      workspaceId: h.workspaceId,
      parentType: 'page',
      parentId: h.page.id,
      actor: h.userId,
      children: [
        { type: 'paragraph', content: { paragraph: { rich_text: [], color: 'default' } } },
      ],
    });
    const client = makeClient();
    const result = await client.v3.submitTransaction({
      transactions: [
        {
          spaceId: h.workspaceId,
          operations: [
            { id: block!.id, table: 'block', path: ['alive'], command: 'set', args: false },
          ],
        },
      ],
    });
    expect(result.applied).toBe(1);
  });
});
