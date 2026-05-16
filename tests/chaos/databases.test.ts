import { type TestHarness, bootTestHarness, closeHarness } from '@bloc/api/test-helpers';
import { LATEST_VERSION } from '@bloc/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let h: TestHarness;
let dbId: string;

beforeEach(async () => {
  h = await bootTestHarness();
  const headers = {
    authorization: h.bearer,
    'notion-version': LATEST_VERSION,
    'content-type': 'application/json',
  };
  const res = await h.app.request('http://t/v1/databases', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      parent: { type: 'page_id', page_id: h.page.id },
      properties: { Name: { type: 'title', title: {} } },
    }),
  });
  const body = (await res.json()) as { id: string };
  dbId = body.id;
});
afterEach(async () => {
  await closeHarness(h);
});

const BASE = 'http://test.local';

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('authorization')) headers.set('authorization', h.bearer);
  if (!headers.has('notion-version')) headers.set('notion-version', LATEST_VERSION);
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  return h.app.request(BASE + path, { ...init, headers });
}

describe('databases API chaos', () => {
  it('rejects filter nesting depth > 2', async () => {
    const res = await call(`/v1/databases/${dbId}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter: {
          and: [
            {
              or: [
                {
                  and: [{ property: 'Name', title: { contains: 'x' } }],
                },
              ],
            },
          ],
        },
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects unknown filter operator', async () => {
    const res = await call(`/v1/databases/${dbId}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter: { property: 'Name', title: { fizzbuzz: 'x' } },
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects malformed cursor', async () => {
    const res = await call(`/v1/databases/${dbId}/query`, {
      method: 'POST',
      body: JSON.stringify({ start_cursor: 'not-a-cursor' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects oversized page_size', async () => {
    const res = await call(`/v1/databases/${dbId}/query`, {
      method: 'POST',
      body: JSON.stringify({ page_size: 999 }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects sort array > 8 entries', async () => {
    const res = await call(`/v1/databases/${dbId}/query`, {
      method: 'POST',
      body: JSON.stringify({
        sorts: Array.from({ length: 9 }, () => ({ property: 'Name', direction: 'ascending' })),
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects mixed and+or at same level', async () => {
    const res = await call(`/v1/databases/${dbId}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter: {
          and: [{ property: 'Name', title: { contains: 'a' } }],
          or: [{ property: 'Name', title: { contains: 'b' } }],
        },
      }),
    });
    expect(res.status).toBe(400);
  });
});
