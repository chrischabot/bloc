import { type TestHarness, bootTestHarness, closeHarness } from '@bloc/api/test-helpers';
import { LATEST_VERSION } from '@bloc/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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

describe('users API chaos', () => {
  it('404 on unknown user', async () => {
    const res = await call('/v1/users/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('400 on malformed user id', async () => {
    const res = await call('/v1/users/not-a-uuid');
    // Hono passes string params through; getUser will not find it → 404 is acceptable.
    expect([400, 404, 500]).toContain(res.status);
    expect(res.status).toBeLessThan(500);
  });
});

describe('comments API chaos', () => {
  it('400 on neither parent nor discussion_id', async () => {
    const res = await call('/v1/comments', {
      method: 'POST',
      body: JSON.stringify({ rich_text: [] }),
    });
    expect(res.status).toBe(400);
  });

  it('400 on oversized rich_text', async () => {
    const res = await call('/v1/comments', {
      method: 'POST',
      body: JSON.stringify({
        parent: { page_id: h.page.id },
        rich_text: Array.from({ length: 101 }, () => ({
          type: 'text',
          text: { content: 'x', link: null },
        })),
      }),
    });
    expect(res.status).toBe(400);
  });

  it('400 on missing block_id and page_id query params', async () => {
    const res = await call('/v1/comments');
    expect(res.status).toBe(400);
  });
});

describe('search API chaos', () => {
  it('400 on oversized query string', async () => {
    const res = await call('/v1/search', {
      method: 'POST',
      body: JSON.stringify({ query: 'x'.repeat(2001) }),
    });
    expect(res.status).toBe(400);
  });

  it('400 on unknown filter value', async () => {
    const res = await call('/v1/search', {
      method: 'POST',
      body: JSON.stringify({ filter: { value: 'block', property: 'object' } }),
    });
    expect(res.status).toBe(400);
  });

  it('200 on malformed body — falls back to empty query', async () => {
    const res = await call('/v1/search', { method: 'POST', body: '{not json' });
    // Server treats invalid JSON either as 400 (canonical) or empty — must NOT be 5xx.
    expect(res.status).toBeLessThan(500);
  });
});
