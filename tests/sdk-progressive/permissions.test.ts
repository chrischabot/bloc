import { type TestHarness, bootTestHarness, closeHarness } from '@bloc/api/test-helpers';
import { createUser } from '@bloc/db';
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

describe('SDK-progressive: permissions namespace', () => {
  it('list + grant + list + revoke round-trip', async () => {
    const client = makeClient();
    const start = await client.permissions.list({ page_id: h.page.id });
    const initial = start.results.length;

    const newUser = await createUser(h.handle.db, {
      email: `pm${Date.now()}@local`,
      type: 'person',
    });
    await client.permissions.grant({
      page_id: h.page.id,
      grantee_type: 'user',
      grantee_id: newUser.id,
      level: 'can_read',
    });

    const afterGrant = await client.permissions.list({ page_id: h.page.id });
    expect(afterGrant.results.length).toBe(initial + 1);
    expect(
      afterGrant.results.some((r) => r.grantee_id === newUser.id && r.level === 'can_read'),
    ).toBe(true);

    await client.permissions.revoke({ page_id: h.page.id, grantee_id: newUser.id });

    const afterRevoke = await client.permissions.list({ page_id: h.page.id });
    expect(afterRevoke.results.some((r) => r.grantee_id === newUser.id)).toBe(false);
  });

  it('me convenience returns full_access for the owner', async () => {
    const client = makeClient();
    const result = await client.permissions.me({ page_id: h.page.id });
    expect(result.object).toBe('permission');
    expect(result.level).toBe('full_access');
  });
});
