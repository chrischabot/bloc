import { appendChildren, createPage } from '@bloc/db';
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

describe('backlinks API', () => {
  it('reindex picks up @page mentions and listing returns them on the target', async () => {
    const target = await createPage(h.handle.db, {
      workspaceId: h.workspaceId,
      parentType: 'workspace',
      createdBy: h.userId,
      lastEditedBy: h.userId,
    });
    const source = await createPage(h.handle.db, {
      workspaceId: h.workspaceId,
      parentType: 'workspace',
      createdBy: h.userId,
      lastEditedBy: h.userId,
    });
    await appendChildren(h.handle.db, {
      workspaceId: h.workspaceId,
      parentType: 'page',
      parentId: source.id,
      actor: h.userId,
      children: [
        {
          type: 'paragraph',
          content: {
            paragraph: {
              rich_text: [
                {
                  type: 'mention',
                  mention: { type: 'page', page: { id: target.id } },
                  plain_text: '@target',
                  annotations: {},
                  href: null,
                },
              ],
              color: 'default',
            },
          },
        },
      ],
    });

    const reindex = await call(`/v1/pages/${source.id}/backlinks:reindex`, { method: 'POST' });
    expect(reindex.status).toBe(200);
    const reindexBody = (await reindex.json()) as { count: number };
    expect(reindexBody.count).toBeGreaterThanOrEqual(1);

    const list = await call(`/v1/pages/${target.id}/backlinks`);
    expect(list.status).toBe(200);
    const body = (await list.json()) as {
      results: { source_page_id: string; kind: string; snippet: string | null }[];
    };
    expect(body.results.length).toBeGreaterThanOrEqual(1);
    expect(body.results[0]!.source_page_id).toBe(source.id);
    expect(body.results[0]!.kind).toBe('mention');
  });

  it('picks up link_to_page blocks', async () => {
    const target = await createPage(h.handle.db, {
      workspaceId: h.workspaceId,
      parentType: 'workspace',
      createdBy: h.userId,
      lastEditedBy: h.userId,
    });
    const source = await createPage(h.handle.db, {
      workspaceId: h.workspaceId,
      parentType: 'workspace',
      createdBy: h.userId,
      lastEditedBy: h.userId,
    });
    await appendChildren(h.handle.db, {
      workspaceId: h.workspaceId,
      parentType: 'page',
      parentId: source.id,
      actor: h.userId,
      children: [
        {
          type: 'link_to_page',
          content: {
            link_to_page: { type: 'page_id', page_id: target.id },
          },
        },
      ],
    });
    await call(`/v1/pages/${source.id}/backlinks:reindex`, { method: 'POST' });
    const list = await call(`/v1/pages/${target.id}/backlinks`);
    const body = (await list.json()) as { results: { kind: string }[] };
    expect(body.results.some((r) => r.kind === 'link_to_page')).toBe(true);
  });

  it('returns empty list for unreferenced pages', async () => {
    const orphan = await createPage(h.handle.db, {
      workspaceId: h.workspaceId,
      parentType: 'workspace',
      createdBy: h.userId,
      lastEditedBy: h.userId,
    });
    const res = await call(`/v1/pages/${orphan.id}/backlinks`);
    const body = (await res.json()) as { results: unknown[]; has_more: boolean };
    expect(body.results).toEqual([]);
    expect(body.has_more).toBe(false);
  });

  it('returns 404 for unknown page id', async () => {
    const res = await call('/v1/pages/00000000-0000-0000-0000-000000000000/backlinks');
    expect(res.status).toBe(404);
  });
});
