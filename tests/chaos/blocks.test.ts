import { type TestHarness, bootTestHarness, closeHarness } from '@bloc/api/test-helpers';
import { LATEST_VERSION } from '@bloc/shared';
import fc from 'fast-check';
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

describe('blocks API chaos', () => {
  it('returns 400 on malformed JSON body', async () => {
    const res = await call(`/v1/blocks/${h.page.id}/children`, {
      method: 'PATCH',
      body: '{not json',
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('returns 400 on missing children field', async () => {
    const res = await call(`/v1/blocks/${h.page.id}/children`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('invalid_request');
  });

  it('rejects unknown block type', async () => {
    const res = await call(`/v1/blocks/${h.page.id}/children`, {
      method: 'PATCH',
      body: JSON.stringify({
        children: [{ type: 'definitely_not_a_block', foo: { bar: 'baz' } }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects rich_text content > 2000 chars', async () => {
    const res = await call(`/v1/blocks/${h.page.id}/children`, {
      method: 'PATCH',
      body: JSON.stringify({
        children: [
          {
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: 'a'.repeat(2001), link: null } }],
              color: 'default',
            },
          },
        ],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects > 100 nodes in rich_text array', async () => {
    const res = await call(`/v1/blocks/${h.page.id}/children`, {
      method: 'PATCH',
      body: JSON.stringify({
        children: [
          {
            type: 'paragraph',
            paragraph: {
              rich_text: Array.from({ length: 101 }, () => ({
                type: 'text',
                text: { content: 'x', link: null },
              })),
              color: 'default',
            },
          },
        ],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects non-http link URLs', async () => {
    const res = await call(`/v1/blocks/${h.page.id}/children`, {
      method: 'PATCH',
      body: JSON.stringify({
        children: [
          {
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  type: 'text',
                  text: { content: 'click', link: { url: 'javascript:alert(1)' } },
                },
              ],
              color: 'default',
            },
          },
        ],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('every error response uses the canonical envelope', async () => {
    const bad = await call('/v1/blocks/00000000-0000-0000-0000-000000000000');
    const body = (await bad.json()) as Record<string, unknown>;
    expect(body['object']).toBe('error');
    expect(typeof body['status']).toBe('number');
    expect(typeof body['code']).toBe('string');
    expect(typeof body['message']).toBe('string');
    expect(typeof body['request_id']).toBe('string');
  });

  it('property test: arbitrary page_size values', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: -10, max: 200 }), async (size) => {
        const res = await call(`/v1/blocks/${h.page.id}/children?page_size=${size}`);
        // Either valid pagination range -> 200, or out of range -> 4xx.
        if (size >= 1 && size <= 100) {
          expect(res.status).toBe(200);
        } else {
          // The server clamps in our impl, but a 400 is also acceptable. Either way, never 5xx.
          expect(res.status).toBeLessThan(500);
        }
      }),
      { numRuns: 30 },
    );
  });
});
