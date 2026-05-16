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

describe('search API', () => {
  it('returns recent objects on empty query', async () => {
    const res = await call('/v1/search', { method: 'POST', body: JSON.stringify({}) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { object: string; results: unknown[] };
    expect(body.object).toBe('list');
    // The seeded page in the harness should appear.
    expect(body.results.length).toBeGreaterThanOrEqual(1);
  });

  it('substring-matches database title', async () => {
    // Create a database first.
    await call('/v1/databases', {
      method: 'POST',
      body: JSON.stringify({
        parent: { type: 'page_id', page_id: h.page.id },
        title: [{ type: 'text', text: { content: 'Project Apollo', link: null } }],
        properties: { Name: { type: 'title', title: {} } },
      }),
    });
    const res = await call('/v1/search', {
      method: 'POST',
      body: JSON.stringify({
        query: 'Apollo',
        filter: { value: 'database', property: 'object' },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: { object: string }[] };
    expect(body.results.some((r) => r.object === 'database')).toBe(true);
  });

  it('rejects > 100 page_size', async () => {
    const res = await call('/v1/search', {
      method: 'POST',
      body: JSON.stringify({ page_size: 101 }),
    });
    expect(res.status).toBe(400);
  });
});
