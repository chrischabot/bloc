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

describe('SDK-progressive: users / comments / search', () => {
  it.skipIf(!unblocked['users.me'])('users.me', async () => {
    const me = await makeClient().users.me();
    expect(me.id).toBe(h.userId);
  });

  it.skipIf(!unblocked['users.list'])('users.list', async () => {
    const res = await makeClient().users.list({ page_size: 10 });
    expect(res.object).toBe('list');
    expect(res.results.length).toBeGreaterThanOrEqual(1);
  });

  it.skipIf(!unblocked['comments.create'])('comments.create + list', async () => {
    const client = makeClient();
    const c = await client.comments.create({
      parent: { page_id: h.page.id },
      rich_text: [{ type: 'text', text: { content: 'hi', link: null } }],
    });
    expect(c.object).toBe('comment');
    const list = await client.comments.list({ page_id: h.page.id });
    expect(list.results).toHaveLength(1);
  });

  it.skipIf(!unblocked['search'])('search returns recent objects on empty query', async () => {
    const res = await makeClient().search({});
    expect(res.object).toBe('list');
    expect(res.results.length).toBeGreaterThanOrEqual(1);
  });
});
