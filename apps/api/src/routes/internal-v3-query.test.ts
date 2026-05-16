import { createDatabase, createPage, createProperty, setPageProperty } from '@bloc/db';
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

async function seedDb(): Promise<{ databaseId: string; titleId: string }> {
  const dbRow = await createDatabase(h.handle.db, {
    workspaceId: h.workspaceId,
    parentType: 'page',
    parentId: h.page.id,
    title: [],
    description: [],
    createdBy: h.userId,
    lastEditedBy: h.userId,
  });
  const title = await createProperty(h.handle.db, {
    databaseId: dbRow.id,
    name: 'Name',
    type: 'title',
  });
  // Seed three rows.
  for (const t of ['Apple pie', 'Banana bread', 'Cherry tart']) {
    const row = await createPage(h.handle.db, {
      workspaceId: h.workspaceId,
      parentType: 'database',
      parentId: dbRow.id,
      createdBy: h.userId,
      lastEditedBy: h.userId,
    });
    await setPageProperty(h.handle.db, {
      pageId: row.id,
      propertyId: title.id,
      value: {
        type: 'title',
        title: [
          {
            type: 'text',
            text: { content: t, link: null },
            plain_text: t,
            href: null,
            annotations: {},
          },
        ],
      },
    });
  }
  return { databaseId: dbRow.id, titleId: title.id };
}

describe('v3 queryCollection', () => {
  it('returns all rows when no loader provided', async () => {
    const { databaseId } = await seedDb();
    const res = await call('/api/v3/queryCollection', {
      method: 'POST',
      body: JSON.stringify({ collection: { id: databaseId } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      recordMap: { collection?: Record<string, unknown> };
      result: { blockIds: string[]; total: number; type: string };
    };
    expect(body.result.type).toBe('table');
    expect(body.result.total).toBe(3);
    expect(body.result.blockIds).toHaveLength(3);
    expect(body.recordMap.collection).toBeDefined();
  });

  it('honors loader.limit', async () => {
    const { databaseId } = await seedDb();
    const res = await call('/api/v3/queryCollection', {
      method: 'POST',
      body: JSON.stringify({
        collection: { id: databaseId },
        loader: { type: 'reducer', limit: 2 },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { blockIds: string[]; total: number } };
    expect(body.result.blockIds).toHaveLength(2);
  });

  it('searchQuery filters by substring match', async () => {
    const { databaseId } = await seedDb();
    const res = await call('/api/v3/queryCollection', {
      method: 'POST',
      body: JSON.stringify({
        collection: { id: databaseId },
        loader: { type: 'reducer', limit: 100, searchQuery: 'banana' },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { blockIds: string[]; total: number } };
    expect(body.result.total).toBe(1);
  });

  it('queryCollectionV2 alias works', async () => {
    const { databaseId } = await seedDb();
    const res = await call('/api/v3/queryCollectionV2', {
      method: 'POST',
      body: JSON.stringify({ collection: { id: databaseId } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { total: number } };
    expect(body.result.total).toBe(3);
  });

  it('404 on unknown collection', async () => {
    const res = await call('/api/v3/queryCollection', {
      method: 'POST',
      body: JSON.stringify({
        collection: { id: '00000000-0000-0000-0000-000000000000' },
      }),
    });
    expect(res.status).toBe(404);
  });

  it('400 on missing collection.id', async () => {
    const res = await call('/api/v3/queryCollection', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('404 on cross-workspace access', async () => {
    const { databaseId } = await seedDb();
    const other = await bootTestHarness();
    try {
      const res = await other.app.request(`${BASE}/api/v3/queryCollection`, {
        method: 'POST',
        headers: {
          authorization: other.bearer,
          'notion-version': LATEST_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ collection: { id: databaseId } }),
      });
      expect(res.status).toBe(404);
    } finally {
      await closeHarness(other);
    }
  });
});
