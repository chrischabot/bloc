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
  if (!headers.has('authorization')) headers.set('authorization', h.bearer);
  if (!headers.has('notion-version')) headers.set('notion-version', LATEST_VERSION);
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  return h.app.request(BASE + path, { ...init, headers });
}

describe('pages API chaos', () => {
  it('rejects missing parent', async () => {
    const res = await call('/v1/pages', { method: 'POST', body: JSON.stringify({}) });
    expect(res.status).toBe(400);
  });

  it('rejects unknown parent type', async () => {
    const res = await call('/v1/pages', {
      method: 'POST',
      body: JSON.stringify({ parent: { type: 'block_id', block_id: h.page.id } }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects oversized children (>100)', async () => {
    const res = await call('/v1/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { type: 'workspace', workspace: true },
        children: Array.from({ length: 101 }, () => ({
          type: 'paragraph',
          paragraph: { rich_text: [], color: 'default' },
        })),
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects malformed JSON', async () => {
    const res = await call('/v1/pages', { method: 'POST', body: '{bad json' });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('invalid_request');
  });

  it('rejects 404-non-existent parent page', async () => {
    const res = await call('/v1/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { type: 'page_id', page_id: '00000000-0000-0000-0000-000000000000' },
      }),
    });
    expect([400, 404]).toContain(res.status);
  });

  it('rejects 404-non-existent database parent', async () => {
    const res = await call('/v1/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { type: 'database_id', database_id: '00000000-0000-0000-0000-000000000000' },
      }),
    });
    expect(res.status).toBe(404);
  });

  it('returns the canonical error envelope', async () => {
    const res = await call('/v1/pages/00000000-0000-0000-0000-000000000000');
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['object']).toBe('error');
    expect(typeof body['code']).toBe('string');
    expect(typeof body['request_id']).toBe('string');
  });
});
