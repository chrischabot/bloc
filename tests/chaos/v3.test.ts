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

/** Assert a Response carries the canonical Notion error envelope. */
async function expectCanonicalError(
  res: Response,
  expectedStatus: number,
  expectedCode?: string,
): Promise<void> {
  expect(res.status).toBe(expectedStatus);
  const body = (await res.json()) as Record<string, unknown>;
  expect(body['object']).toBe('error');
  expect(typeof body['status']).toBe('number');
  expect(body['status']).toBe(expectedStatus);
  expect(typeof body['code']).toBe('string');
  expect(typeof body['message']).toBe('string');
  expect(typeof body['request_id']).toBe('string');
  if (expectedCode !== undefined) {
    expect(body['code']).toBe(expectedCode);
  }
}

describe('internal v3 API chaos', () => {
  it('rejects oversize getRecordValues batch (>100)', async () => {
    const requests = Array.from({ length: 101 }, () => ({
      table: 'block',
      id: '00000000-0000-0000-0000-000000000000',
    }));
    const res = await call('/api/v3/getRecordValues', {
      method: 'POST',
      body: JSON.stringify({ requests }),
    });
    await expectCanonicalError(res, 400, 'invalid_request');
  });

  it('rejects unknown table in getRecordValues', async () => {
    const res = await call('/api/v3/getRecordValues', {
      method: 'POST',
      body: JSON.stringify({
        requests: [{ table: 'definitely_not_a_table', id: h.page.id }],
      }),
    });
    await expectCanonicalError(res, 400, 'invalid_request');
  });

  it('rejects unknown command in submitTransaction', async () => {
    const res = await call('/api/v3/submitTransaction', {
      method: 'POST',
      body: JSON.stringify({
        transactions: [
          {
            spaceId: h.workspaceId,
            operations: [
              {
                id: h.page.id,
                table: 'block',
                path: [],
                command: 'frobulate',
                args: {},
              },
            ],
          },
        ],
      }),
    });
    await expectCanonicalError(res, 400, 'invalid_request');
  });

  it('rejects oversize submitTransaction operations array (>500)', async () => {
    const operations = Array.from({ length: 501 }, () => ({
      id: h.page.id,
      table: 'block',
      path: ['alive'],
      command: 'set',
      args: true,
    }));
    const res = await call('/api/v3/submitTransaction', {
      method: 'POST',
      body: JSON.stringify({
        transactions: [{ spaceId: h.workspaceId, operations }],
      }),
    });
    await expectCanonicalError(res, 400, 'invalid_request');
  });

  it('rejects oversize transactions array (>10)', async () => {
    const transactions = Array.from({ length: 11 }, () => ({
      spaceId: h.workspaceId,
      operations: [{ id: h.page.id, table: 'block', path: [], command: 'update', args: {} }],
    }));
    const res = await call('/api/v3/submitTransaction', {
      method: 'POST',
      body: JSON.stringify({ transactions }),
    });
    await expectCanonicalError(res, 400, 'invalid_request');
  });

  it('rejects deeply nested path (>8)', async () => {
    const res = await call('/api/v3/submitTransaction', {
      method: 'POST',
      body: JSON.stringify({
        transactions: [
          {
            spaceId: h.workspaceId,
            operations: [
              {
                id: h.page.id,
                table: 'block',
                path: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'],
                command: 'set',
                args: {},
              },
            ],
          },
        ],
      }),
    });
    await expectCanonicalError(res, 400, 'invalid_request');
  });

  it('rejects spaceId mismatch (cross-workspace transaction)', async () => {
    const res = await call('/api/v3/submitTransaction', {
      method: 'POST',
      body: JSON.stringify({
        transactions: [
          {
            spaceId: '11111111-1111-1111-1111-111111111111',
            operations: [
              {
                id: h.page.id,
                table: 'block',
                path: ['alive'],
                command: 'set',
                args: true,
              },
            ],
          },
        ],
      }),
    });
    await expectCanonicalError(res, 400, 'invalid_request');
  });

  it('rejects malformed JSON on loadPageChunk', async () => {
    const res = await call('/api/v3/loadPageChunk', {
      method: 'POST',
      body: '{not json',
    });
    await expectCanonicalError(res, 400, 'invalid_request');
  });

  it('404 on loadPageChunk with unknown page', async () => {
    const res = await call('/api/v3/loadPageChunk', {
      method: 'POST',
      body: JSON.stringify({
        pageId: '00000000-0000-0000-0000-000000000000',
        limit: 50,
      }),
    });
    await expectCanonicalError(res, 404, 'object_not_found');
  });

  it('401 when no bearer is supplied', async () => {
    const res = await h.app.request(`${BASE}/api/v3/loadPageChunk`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'notion-version': LATEST_VERSION },
      body: JSON.stringify({ pageId: h.page.id }),
    });
    await expectCanonicalError(res, 401, 'unauthorized');
  });

  it('rejects non-uuid id in syncRecordValues', async () => {
    const res = await call('/api/v3/syncRecordValues', {
      method: 'POST',
      body: JSON.stringify({
        requests: [{ pointer: { table: 'block', id: 'not-a-uuid' }, version: 0 }],
      }),
    });
    await expectCanonicalError(res, 400, 'invalid_request');
  });

  it('rejects empty requests array', async () => {
    const res = await call('/api/v3/getRecordValues', {
      method: 'POST',
      body: JSON.stringify({ requests: [] }),
    });
    await expectCanonicalError(res, 400, 'invalid_request');
  });

  it('rejects oversize path arrays inside operations (>8)', async () => {
    const tooDeep = Array.from({ length: 9 }, (_, i) => `seg${i}`);
    const res = await call('/api/v3/submitTransaction', {
      method: 'POST',
      body: JSON.stringify({
        transactions: [
          {
            spaceId: h.workspaceId,
            operations: [
              {
                id: h.page.id,
                table: 'block',
                path: tooDeep,
                command: 'set',
                args: {},
              },
            ],
          },
        ],
      }),
    });
    await expectCanonicalError(res, 400, 'invalid_request');
  });
});
