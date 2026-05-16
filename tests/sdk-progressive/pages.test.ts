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

describe('SDK-progressive: pages', () => {
  it.skipIf(!unblocked['pages.create'])('pages.create + retrieve round-trip', async () => {
    const client = makeClient();
    const page = await client.pages.create({
      parent: { type: 'workspace', workspace: true },
      icon: { type: 'emoji', emoji: '⭐' },
    });
    expect(page.object).toBe('page');
    expect(page.id).toBeTruthy();

    const fetched = await client.pages.retrieve({ page_id: page.id });
    expect(fetched.id).toBe(page.id);
  });

  it.skipIf(!unblocked['pages.update'])('pages.update changes icon', async () => {
    const client = makeClient();
    const page = await client.pages.create({
      parent: { type: 'workspace', workspace: true },
    });
    const updated = await client.pages.update({
      page_id: page.id,
      icon: { type: 'emoji', emoji: '🎯' },
    });
    expect((updated.icon as { emoji: string }).emoji).toBe('🎯');
  });
});
