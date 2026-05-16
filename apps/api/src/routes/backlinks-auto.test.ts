import { createPage } from '@bloc/db';
import { LATEST_VERSION } from '@bloc/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { drainBacklinksReindex } from '../backlinks/reindex.ts';
import { type TestHarness, bootTestHarness, closeHarness } from '../test-helpers.ts';

let h: TestHarness;

beforeEach(async () => {
  h = await bootTestHarness();
});
afterEach(async () => {
  await drainBacklinksReindex();
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

describe('backlinks auto-reindex on block mutations', () => {
  it('appending a paragraph that mentions a page populates the target backlinks', async () => {
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

    const append = await call(`/v1/blocks/${source.id}/children`, {
      method: 'PATCH',
      body: JSON.stringify({
        children: [
          {
            type: 'paragraph',
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
        ],
      }),
    });
    expect(append.status).toBe(200);

    // Wait for the background reindex to settle before asserting.
    await drainBacklinksReindex();

    const list = await call(`/v1/pages/${target.id}/backlinks`);
    expect(list.status).toBe(200);
    const body = (await list.json()) as {
      results: { source_page_id: string; kind: string }[];
    };
    expect(body.results.length).toBeGreaterThanOrEqual(1);
    expect(body.results[0]!.source_page_id).toBe(source.id);
    expect(body.results[0]!.kind).toBe('mention');
  });

  it('updating a paragraph to remove the mention drops the backlink', async () => {
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

    const append = await call(`/v1/blocks/${source.id}/children`, {
      method: 'PATCH',
      body: JSON.stringify({
        children: [
          {
            type: 'paragraph',
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
        ],
      }),
    });
    const { results } = (await append.json()) as { results: { id: string }[] };
    const blockId = results[0]!.id;
    await drainBacklinksReindex();

    // Sanity: backlink exists.
    let list = await call(`/v1/pages/${target.id}/backlinks`);
    let body = (await list.json()) as { results: unknown[] };
    expect(body.results.length).toBeGreaterThanOrEqual(1);

    // Mutate the paragraph to remove the mention.
    const update = await call(`/v1/blocks/${blockId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        paragraph: {
          rich_text: [{ type: 'text', text: { content: 'just text', link: null } }],
          color: 'default',
        },
      }),
    });
    expect(update.status).toBe(200);
    await drainBacklinksReindex();

    list = await call(`/v1/pages/${target.id}/backlinks`);
    body = (await list.json()) as { results: unknown[] };
    expect(body.results).toHaveLength(0);
  });

  it('deleting a mention-bearing block drops the backlink', async () => {
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
    const append = await call(`/v1/blocks/${source.id}/children`, {
      method: 'PATCH',
      body: JSON.stringify({
        children: [
          {
            type: 'paragraph',
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
        ],
      }),
    });
    const { results } = (await append.json()) as { results: { id: string }[] };
    const blockId = results[0]!.id;
    await drainBacklinksReindex();

    const del = await call(`/v1/blocks/${blockId}`, { method: 'DELETE' });
    expect(del.status).toBe(200);
    await drainBacklinksReindex();

    const list = await call(`/v1/pages/${target.id}/backlinks`);
    const body = (await list.json()) as { results: unknown[] };
    expect(body.results).toHaveLength(0);
  });
});
