import { type TestHarness, bootTestHarness, closeHarness } from '@bloc/api/test-helpers';
import { LATEST_VERSION } from '@bloc/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let h: TestHarness;

beforeEach(async () => {
  h = await bootTestHarness();
  // Re-enable the rate limiter for these tests.
  process.env['RATE_LIMIT_DISABLE'] = '0';
});
afterEach(async () => {
  process.env['RATE_LIMIT_DISABLE'] = '1';
  await closeHarness(h);
});

const BASE = 'http://test.local';

describe('rate limiter', () => {
  it('returns 429 after exhausting the session bucket', async () => {
    // Session bucket capacity = 300; create an integration to use the stricter
    // integration bucket (capacity 30). Mint one and call /users/me until 429.
    const { bearer } = await h.mintIntegration();
    let last429: Response | null = null;
    for (let i = 0; i < 60; i++) {
      const res = await h.app.request(`${BASE}/v1/users/me`, {
        headers: { authorization: bearer, 'notion-version': LATEST_VERSION },
      });
      if (res.status === 429) {
        last429 = res;
        break;
      }
    }
    expect(last429).not.toBeNull();
    expect(last429!.headers.get('retry-after')).toMatch(/^\d+$/);
    const body = (await last429!.json()) as { code: string };
    expect(body.code).toBe('rate_limited');
  });
});
