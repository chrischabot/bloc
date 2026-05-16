import { createDatabase, createProperty } from '@bloc/db';
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
  if (!headers.has('authorization')) headers.set('authorization', h.bearer);
  if (!headers.has('notion-version')) headers.set('notion-version', LATEST_VERSION);
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  return h.app.request(BASE + path, { ...init, headers });
}

async function seedDatabase(): Promise<{
  databaseId: string;
  titlePropId: string;
  statusPropId: string;
}> {
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
  const status = await createProperty(h.handle.db, {
    databaseId: dbRow.id,
    name: 'Status',
    type: 'select',
    config: {
      options: [
        { name: 'Todo', color: 'gray' },
        { name: 'Done', color: 'green' },
      ],
    },
  });
  return { databaseId: dbRow.id, titlePropId: title.id, statusPropId: status.id };
}

describe('pages API', () => {
  describe('POST /v1/pages', () => {
    it('creates a workspace-parent page', async () => {
      const res = await call('/v1/pages', {
        method: 'POST',
        body: JSON.stringify({
          parent: { type: 'workspace', workspace: true },
          icon: { type: 'emoji', emoji: '📝' },
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { object: string; icon: { emoji: string } };
      expect(body.object).toBe('page');
      expect(body.icon.emoji).toBe('📝');
    });

    it('creates a page-parent page', async () => {
      const res = await call('/v1/pages', {
        method: 'POST',
        body: JSON.stringify({ parent: { type: 'page_id', page_id: h.page.id } }),
      });
      expect(res.status).toBe(200);
    });

    it('creates a database-row page with title + select', async () => {
      const { databaseId } = await seedDatabase();
      const res = await call('/v1/pages', {
        method: 'POST',
        body: JSON.stringify({
          parent: { type: 'database_id', database_id: databaseId },
          properties: {
            Name: { title: [{ type: 'text', text: { content: 'Buy milk', link: null } }] },
            Status: { select: { name: 'Todo' } },
          },
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        properties: Record<string, { type: string; [key: string]: unknown }>;
      };
      expect(body.properties['Name']!.type).toBe('title');
      expect(body.properties['Status']!.type).toBe('select');
    });

    it('rejects a database-row page missing the title property', async () => {
      const { databaseId } = await seedDatabase();
      const res = await call('/v1/pages', {
        method: 'POST',
        body: JSON.stringify({
          parent: { type: 'database_id', database_id: databaseId },
          properties: { Status: { select: { name: 'Todo' } } },
        }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('invalid_request');
    });

    it('rejects setting a read-only property', async () => {
      const { databaseId } = await seedDatabase();
      await createProperty(h.handle.db, {
        databaseId,
        name: 'Created',
        type: 'created_time',
      });
      const res = await call('/v1/pages', {
        method: 'POST',
        body: JSON.stringify({
          parent: { type: 'database_id', database_id: databaseId },
          properties: {
            Name: { title: [{ type: 'text', text: { content: 'x', link: null } }] },
            Created: { created_time: '2026-05-15T00:00:00Z' },
          },
        }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects unknown property name', async () => {
      const { databaseId } = await seedDatabase();
      const res = await call('/v1/pages', {
        method: 'POST',
        body: JSON.stringify({
          parent: { type: 'database_id', database_id: databaseId },
          properties: {
            Name: { title: [{ type: 'text', text: { content: 'x', link: null } }] },
            Mystery: { rich_text: [] },
          },
        }),
      });
      expect(res.status).toBe(400);
    });

    it('creates with initial children', async () => {
      const res = await call('/v1/pages', {
        method: 'POST',
        body: JSON.stringify({
          parent: { type: 'workspace', workspace: true },
          children: [
            {
              type: 'paragraph',
              paragraph: {
                rich_text: [{ type: 'text', text: { content: 'first block', link: null } }],
                color: 'default',
              },
            },
          ],
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { id: string };
      const childrenRes = await call(`/v1/blocks/${body.id}/children`);
      const childBody = (await childrenRes.json()) as { results: unknown[] };
      expect(childBody.results).toHaveLength(1);
    });
  });

  describe('GET /v1/pages/:id', () => {
    it('retrieves the seeded page', async () => {
      const res = await call(`/v1/pages/${h.page.id}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { object: string; id: string };
      expect(body.object).toBe('page');
      expect(body.id).toBe(h.page.id);
    });

    it('returns 404 for unknown id', async () => {
      const res = await call('/v1/pages/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /v1/pages/:id', () => {
    it('updates icon + cover', async () => {
      const res = await call(`/v1/pages/${h.page.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          icon: { type: 'emoji', emoji: '🎯' },
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { icon: { emoji: string } };
      expect(body.icon.emoji).toBe('🎯');
    });

    it('archives the page', async () => {
      const create = await call('/v1/pages', {
        method: 'POST',
        body: JSON.stringify({ parent: { type: 'workspace', workspace: true } }),
      });
      const { id } = (await create.json()) as { id: string };
      const arch = await call(`/v1/pages/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ archived: true }),
      });
      expect(arch.status).toBe(200);
      const body = (await arch.json()) as { archived: boolean; in_trash: boolean };
      expect(body.archived).toBe(true);
      expect(body.in_trash).toBe(true);
    });

    it('updates a database-row property', async () => {
      const { databaseId } = await seedDatabase();
      const create = await call('/v1/pages', {
        method: 'POST',
        body: JSON.stringify({
          parent: { type: 'database_id', database_id: databaseId },
          properties: {
            Name: { title: [{ type: 'text', text: { content: 'Initial', link: null } }] },
          },
        }),
      });
      const { id } = (await create.json()) as { id: string };
      const upd = await call(`/v1/pages/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          properties: { Status: { select: { name: 'Done' } } },
        }),
      });
      expect(upd.status).toBe(200);
      const body = (await upd.json()) as {
        properties: Record<string, { type: string; select?: { name: string } }>;
      };
      expect(body.properties['Status']!.select!.name).toBe('Done');
    });
  });

  describe('DELETE /v1/pages/:id', () => {
    it('soft-archives by default', async () => {
      const create = await call('/v1/pages', {
        method: 'POST',
        body: JSON.stringify({ parent: { type: 'workspace', workspace: true } }),
      });
      const { id } = (await create.json()) as { id: string };
      const del = await call(`/v1/pages/${id}`, { method: 'DELETE' });
      expect(del.status).toBe(200);
      const body = (await del.json()) as { archived: boolean; in_trash: boolean };
      expect(body.archived).toBe(true);
      expect(body.in_trash).toBe(true);
    });

    it('rejects ?permanent=true on a non-archived page', async () => {
      const create = await call('/v1/pages', {
        method: 'POST',
        body: JSON.stringify({ parent: { type: 'workspace', workspace: true } }),
      });
      const { id } = (await create.json()) as { id: string };
      const del = await call(`/v1/pages/${id}?permanent=true`, { method: 'DELETE' });
      expect(del.status).toBe(400);
    });

    it('hard-deletes an archived page with ?permanent=true', async () => {
      const create = await call('/v1/pages', {
        method: 'POST',
        body: JSON.stringify({ parent: { type: 'workspace', workspace: true } }),
      });
      const { id } = (await create.json()) as { id: string };
      await call(`/v1/pages/${id}`, { method: 'DELETE' });
      const hard = await call(`/v1/pages/${id}?permanent=true`, { method: 'DELETE' });
      expect(hard.status).toBe(204);
      const after = await call(`/v1/pages/${id}`);
      expect(after.status).toBe(404);
    });

    it('404 for unknown id', async () => {
      const res = await call('/v1/pages/00000000-0000-0000-0000-000000000000', {
        method: 'DELETE',
      });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /v1/pages/:id/properties/:propertyId', () => {
    it('returns a property item', async () => {
      const { databaseId, titlePropId } = await seedDatabase();
      const create = await call('/v1/pages', {
        method: 'POST',
        body: JSON.stringify({
          parent: { type: 'database_id', database_id: databaseId },
          properties: {
            Name: { title: [{ type: 'text', text: { content: 'Item', link: null } }] },
          },
        }),
      });
      const { id } = (await create.json()) as { id: string };
      const prop = await call(`/v1/pages/${id}/properties/${titlePropId}`);
      expect(prop.status).toBe(200);
      const body = (await prop.json()) as { object: string; type: string };
      expect(body.object).toBe('property_item');
      expect(body.type).toBe('title');
    });

    it('returns 404 for unknown property id', async () => {
      const res = await call(
        `/v1/pages/${h.page.id}/properties/00000000-0000-0000-0000-000000000000`,
      );
      expect(res.status).toBe(404);
    });
  });
});
