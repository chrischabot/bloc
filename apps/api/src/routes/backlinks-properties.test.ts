import {
  createDatabase,
  createPage,
  createProperty,
  reindexBacklinksForPage,
  setPageProperty,
} from '@bloc/db';
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

describe('backlinks indexer — page property values', () => {
  it('relation property value produces a relation backlink', async () => {
    const target = await createPage(h.handle.db, {
      workspaceId: h.workspaceId,
      parentType: 'workspace',
      createdBy: h.userId,
      lastEditedBy: h.userId,
    });
    const dbRow = await createDatabase(h.handle.db, {
      workspaceId: h.workspaceId,
      parentType: 'page',
      parentId: h.page.id,
      title: [],
      description: [],
      createdBy: h.userId,
      lastEditedBy: h.userId,
    });
    const relProp = await createProperty(h.handle.db, {
      databaseId: dbRow.id,
      name: 'Linked',
      type: 'relation',
      config: { database_id: dbRow.id },
    });
    const sourceRow = await createPage(h.handle.db, {
      workspaceId: h.workspaceId,
      parentType: 'database',
      parentId: dbRow.id,
      createdBy: h.userId,
      lastEditedBy: h.userId,
    });
    await setPageProperty(h.handle.db, {
      pageId: sourceRow.id,
      propertyId: relProp.id,
      value: { type: 'relation', relation: [{ id: target.id }] },
    });

    await reindexBacklinksForPage(h.handle.db, sourceRow.id);

    const res = await call(`/v1/pages/${target.id}/backlinks`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      results: { source_page_id: string; kind: string }[];
    };
    expect(
      body.results.some((r) => r.source_page_id === sourceRow.id && r.kind === 'relation'),
    ).toBe(true);
  });

  it('rich_text mention inside a property value produces a mention backlink', async () => {
    const target = await createPage(h.handle.db, {
      workspaceId: h.workspaceId,
      parentType: 'workspace',
      createdBy: h.userId,
      lastEditedBy: h.userId,
    });
    const dbRow = await createDatabase(h.handle.db, {
      workspaceId: h.workspaceId,
      parentType: 'page',
      parentId: h.page.id,
      title: [],
      description: [],
      createdBy: h.userId,
      lastEditedBy: h.userId,
    });
    const notesProp = await createProperty(h.handle.db, {
      databaseId: dbRow.id,
      name: 'Notes',
      type: 'rich_text',
    });
    const sourceRow = await createPage(h.handle.db, {
      workspaceId: h.workspaceId,
      parentType: 'database',
      parentId: dbRow.id,
      createdBy: h.userId,
      lastEditedBy: h.userId,
    });
    await setPageProperty(h.handle.db, {
      pageId: sourceRow.id,
      propertyId: notesProp.id,
      value: {
        type: 'rich_text',
        rich_text: [
          {
            type: 'mention',
            mention: { type: 'page', page: { id: target.id } },
            plain_text: '@target',
            href: null,
            annotations: {},
          },
        ],
      },
    });

    await reindexBacklinksForPage(h.handle.db, sourceRow.id);

    const res = await call(`/v1/pages/${target.id}/backlinks`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: { kind: string }[] };
    expect(body.results.some((r) => r.kind === 'mention')).toBe(true);
  });
});
