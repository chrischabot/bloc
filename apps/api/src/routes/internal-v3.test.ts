import { appendChildren } from '@bloc/db';
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

describe('internal v3 API', () => {
  it('loadPageChunk returns a recordMap for an empty page', async () => {
    const res = await call('/api/v3/loadPageChunk', {
      method: 'POST',
      body: JSON.stringify({ pageId: h.page.id, limit: 50 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { recordMap: { block?: Record<string, unknown> } };
    expect(body.recordMap).toBeDefined();
    expect(body.recordMap.block).toBeDefined();
  });

  it('loadPageChunk includes appended children', async () => {
    await appendChildren(h.handle.db, {
      workspaceId: h.workspaceId,
      parentType: 'page',
      parentId: h.page.id,
      actor: h.userId,
      children: [
        { type: 'paragraph', content: { paragraph: { rich_text: [], color: 'default' } } },
        { type: 'paragraph', content: { paragraph: { rich_text: [], color: 'default' } } },
      ],
    });
    const res = await call('/api/v3/loadPageChunk', {
      method: 'POST',
      body: JSON.stringify({ pageId: h.page.id }),
    });
    const body = (await res.json()) as {
      recordMap: { block: Record<string, { value: { content: string[] } }> };
    };
    const block = body.recordMap.block[h.page.id];
    // The "page" id is recorded as a block-like entry only if a row exists in
    // `blocks` for it — in our schema, pages and blocks are separate, so the
    // page block may not appear. Instead, verify at least 2 child blocks land.
    const blockKeys = Object.keys(body.recordMap.block);
    expect(blockKeys.length).toBeGreaterThanOrEqual(2);
    void block;
  });

  it('getRecordValues returns null for non-existent ids', async () => {
    const res = await call('/api/v3/getRecordValues', {
      method: 'POST',
      body: JSON.stringify({
        requests: [{ table: 'block', id: '00000000-0000-0000-0000-000000000000' }],
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: (object | null)[] };
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toBeNull();
  });

  it('getRecordValues fetches a block by id', async () => {
    const [block] = await appendChildren(h.handle.db, {
      workspaceId: h.workspaceId,
      parentType: 'page',
      parentId: h.page.id,
      actor: h.userId,
      children: [
        { type: 'paragraph', content: { paragraph: { rich_text: [], color: 'default' } } },
      ],
    });
    const res = await call('/api/v3/getRecordValues', {
      method: 'POST',
      body: JSON.stringify({ requests: [{ table: 'block', id: block!.id }] }),
    });
    const body = (await res.json()) as {
      results: { role: string; value: { id: string; type: string } }[];
    };
    expect(body.results[0]).not.toBeNull();
    expect(body.results[0]!.value.id).toBe(block!.id);
    expect(body.results[0]!.value.type).toBe('paragraph');
  });

  it('submitTransaction set alive=false archives a block', async () => {
    const [block] = await appendChildren(h.handle.db, {
      workspaceId: h.workspaceId,
      parentType: 'page',
      parentId: h.page.id,
      actor: h.userId,
      children: [
        { type: 'paragraph', content: { paragraph: { rich_text: [], color: 'default' } } },
      ],
    });
    const res = await call('/api/v3/submitTransaction', {
      method: 'POST',
      body: JSON.stringify({
        transactions: [
          {
            spaceId: h.workspaceId,
            operations: [
              {
                id: block!.id,
                table: 'block',
                path: ['alive'],
                command: 'set',
                args: false,
              },
            ],
          },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { applied: number };
    expect(body.applied).toBe(1);

    // Verify block is archived.
    const fresh = await call('/api/v3/getRecordValues', {
      method: 'POST',
      body: JSON.stringify({ requests: [{ table: 'block', id: block!.id }] }),
    });
    const freshBody = (await fresh.json()) as {
      results: { value: { alive: boolean } }[];
    };
    expect(freshBody.results[0]!.value.alive).toBe(false);
  });

  it('submitTransaction rejects spaceId mismatch', async () => {
    const res = await call('/api/v3/submitTransaction', {
      method: 'POST',
      body: JSON.stringify({
        transactions: [
          {
            spaceId: '00000000-0000-0000-0000-000000000000',
            operations: [
              {
                id: h.page.id,
                table: 'block',
                path: [],
                command: 'update',
                args: {},
              },
            ],
          },
        ],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('loadUserContent returns a recordMap with notion_user + space', async () => {
    const res = await call('/api/v3/loadUserContent', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      recordMap: { notion_user: Record<string, unknown>; space: Record<string, unknown> };
    };
    expect(body.recordMap.notion_user[h.userId]).toBeDefined();
    expect(body.recordMap.space[h.workspaceId]).toBeDefined();
  });

  it('rejects unauthenticated request', async () => {
    const res = await h.app.request(`${BASE}/api/v3/loadPageChunk`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'notion-version': LATEST_VERSION },
      body: JSON.stringify({ pageId: h.page.id }),
    });
    expect(res.status).toBe(401);
  });
});
