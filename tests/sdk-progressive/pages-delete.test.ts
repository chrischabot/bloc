import { type TestHarness, bootTestHarness, closeHarness } from '@bloc/api/test-helpers';
import { Bloc } from '@bloc/sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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

describe('SDK-progressive: pages delete (soft + hard)', () => {
  it('soft delete via client.pages.delete sets archived/in_trash', async () => {
    const client = makeClient();
    const page = await client.pages.create({ parent: { type: 'workspace', workspace: true } });
    const result = await client.pages.delete({ page_id: page.id });
    if (result === undefined) throw new Error('Expected soft delete to return a page');
    expect(result.archived).toBe(true);
    expect(result.in_trash).toBe(true);
  });

  it('hard delete (permanent=true) on an archived page returns undefined', async () => {
    const client = makeClient();
    const page = await client.pages.create({ parent: { type: 'workspace', workspace: true } });
    await client.pages.delete({ page_id: page.id });
    const hard = await client.pages.delete({ page_id: page.id, permanent: true });
    expect(hard).toBeUndefined();

    try {
      await client.pages.retrieve({ page_id: page.id });
      throw new Error('Expected 404 after hard delete');
    } catch (err) {
      expect((err as { status?: number }).status ?? 0).toBe(404);
    }
  });

  it('rejects permanent=true on a non-archived page', async () => {
    const client = makeClient();
    const page = await client.pages.create({ parent: { type: 'workspace', workspace: true } });
    try {
      await client.pages.delete({ page_id: page.id, permanent: true });
      throw new Error('Expected 400');
    } catch (err) {
      expect((err as { status?: number }).status ?? 0).toBe(400);
    }
  });
});
