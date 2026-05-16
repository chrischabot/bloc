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

describe('SDK-progressive: databases', () => {
  it.skipIf(!unblocked['databases.create'])('databases.create + retrieve', async () => {
    const client = makeClient();
    const db = await client.databases.create({
      parent: { type: 'page_id', page_id: h.page.id },
      title: [{ type: 'text', text: { content: 'Tasks', link: null } }],
      properties: {
        Name: { type: 'title', title: {} },
        Done: { type: 'checkbox', checkbox: {} },
      },
    });
    expect(db.object).toBe('database');
    const fetched = await client.databases.retrieve({ database_id: db.id });
    expect(fetched.id).toBe(db.id);
  });

  it.skipIf(!unblocked['databases.query'])('databases.query roundtrip', async () => {
    const client = makeClient();
    const db = await client.databases.create({
      parent: { type: 'page_id', page_id: h.page.id },
      properties: {
        Name: { type: 'title', title: {} },
      },
    });
    await client.pages.create({
      parent: { type: 'database_id', database_id: db.id },
      properties: {
        Name: { title: [{ type: 'text', text: { content: 'one', link: null } }] },
      },
    });
    const result = await client.databases.query({ database_id: db.id });
    expect(result.results).toHaveLength(1);
  });
});
