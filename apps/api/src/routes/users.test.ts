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

async function call(path: string): Promise<Response> {
  return h.app.request(BASE + path, {
    headers: { authorization: h.bearer, 'notion-version': LATEST_VERSION },
  });
}

describe('users API', () => {
  it('GET /v1/users/me returns the bearer user', async () => {
    const res = await call('/v1/users/me');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { object: string; id: string; type: string };
    expect(body.object).toBe('user');
    expect(body.id).toBe(h.userId);
    expect(body.type).toBe('person');
  });

  it('GET /v1/users/:id retrieves a user', async () => {
    const res = await call(`/v1/users/${h.userId}`);
    expect(res.status).toBe(200);
  });

  it('GET /v1/users returns a list', async () => {
    const res = await call('/v1/users');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { object: string; results: unknown[] };
    expect(body.object).toBe('list');
    expect(body.results.length).toBeGreaterThanOrEqual(1);
  });
});
