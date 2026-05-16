import { LATEST_VERSION } from '@bloc/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type TestHarness, bootTestHarness, closeHarness } from '../test-helpers.ts';

let h: TestHarness;

beforeEach(async () => {
  h = await bootTestHarness();
});
afterEach(async () => {
  await closeHarness(h);
});

const BASE = 'http://test.local';

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('authorization', h.bearer);
  headers.set('notion-version', LATEST_VERSION);
  if (init.body !== undefined) headers.set('content-type', 'application/json');
  return h.app.request(BASE + path, { ...init, headers });
}

describe('wikis', () => {
  it('turn into wiki / verify / unverify / turn off', async () => {
    const on = await call(`/v1/pages/${h.page.id}/wiki`, { method: 'POST' });
    expect(on.status).toBe(200);
    const onBody = (await on.json()) as { is_wiki: boolean };
    expect(onBody.is_wiki).toBe(true);

    const verify = await call(`/v1/pages/${h.page.id}/verify`, {
      method: 'POST',
      body: JSON.stringify({ expires_in_days: 30 }),
    });
    expect(verify.status).toBe(200);
    const verifyBody = (await verify.json()) as {
      state: string;
      verified_by: { id: string };
      expires_at: string | null;
    };
    expect(verifyBody.state).toBe('verified');
    expect(verifyBody.verified_by.id).toBe(h.userId);
    expect(verifyBody.expires_at).toMatch(/^\d{4}/);

    const unverify = await call(`/v1/pages/${h.page.id}/unverify`, { method: 'POST' });
    expect(unverify.status).toBe(200);
    const unverifyBody = (await unverify.json()) as { state: string };
    expect(unverifyBody.state).toBe('unverified');

    const off = await call(`/v1/pages/${h.page.id}/wiki`, { method: 'DELETE' });
    expect(off.status).toBe(204);
  });

  it('rejects verify on non-wiki', async () => {
    const res = await call(`/v1/pages/${h.page.id}/verify`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('accepts verify with Never expiry (expires_in_days=null)', async () => {
    await call(`/v1/pages/${h.page.id}/wiki`, { method: 'POST' });
    const verify = await call(`/v1/pages/${h.page.id}/verify`, {
      method: 'POST',
      body: JSON.stringify({ expires_in_days: null }),
    });
    expect(verify.status).toBe(200);
    const body = (await verify.json()) as { expires_at: string | null };
    expect(body.expires_at).toBeNull();
  });
});
