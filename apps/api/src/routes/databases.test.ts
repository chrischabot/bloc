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

async function createTestDb(): Promise<{ id: string }> {
  const res = await call('/v1/databases', {
    method: 'POST',
    body: JSON.stringify({
      parent: { type: 'page_id', page_id: h.page.id },
      title: [{ type: 'text', text: { content: 'Tasks', link: null } }],
      properties: {
        Name: { type: 'title', title: {} },
        Score: { type: 'number', number: { format: 'number' } },
        Done: { type: 'checkbox', checkbox: {} },
        Tag: {
          type: 'select',
          select: { options: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] },
        },
      },
    }),
  });
  expect(res.status).toBe(200);
  return (await res.json()) as { id: string };
}

async function createRow(
  databaseId: string,
  props: Record<string, unknown>,
): Promise<{ id: string }> {
  const res = await call('/v1/pages', {
    method: 'POST',
    body: JSON.stringify({
      parent: { type: 'database_id', database_id: databaseId },
      properties: props,
    }),
  });
  expect(res.status).toBe(200);
  return (await res.json()) as { id: string };
}

describe('databases API', () => {
  describe('POST /v1/databases', () => {
    it('creates a database', async () => {
      const db = await createTestDb();
      expect(db.id).toBeTruthy();
    });

    it('rejects when no title property', async () => {
      const res = await call('/v1/databases', {
        method: 'POST',
        body: JSON.stringify({
          parent: { type: 'page_id', page_id: h.page.id },
          properties: { Score: { type: 'number', number: {} } },
        }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects when more than one title property', async () => {
      const res = await call('/v1/databases', {
        method: 'POST',
        body: JSON.stringify({
          parent: { type: 'page_id', page_id: h.page.id },
          properties: {
            Name1: { type: 'title', title: {} },
            Name2: { type: 'title', title: {} },
          },
        }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /v1/databases/:id', () => {
    it('retrieves with the property schema', async () => {
      const db = await createTestDb();
      const res = await call(`/v1/databases/${db.id}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { object: string; properties: Record<string, unknown> };
      expect(body.object).toBe('database');
      expect(Object.keys(body.properties)).toContain('Name');
      expect(Object.keys(body.properties)).toContain('Score');
    });
  });

  describe('POST /v1/databases/:id/query', () => {
    it('returns all rows when no filter', async () => {
      const db = await createTestDb();
      await createRow(db.id, {
        Name: { title: [{ type: 'text', text: { content: 'A', link: null } }] },
        Score: { number: 10 },
      });
      await createRow(db.id, {
        Name: { title: [{ type: 'text', text: { content: 'B', link: null } }] },
        Score: { number: 20 },
      });
      const res = await call(`/v1/databases/${db.id}/query`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { results: unknown[]; has_more: boolean };
      expect(body.results).toHaveLength(2);
      expect(body.has_more).toBe(false);
    });

    it('filters by title contains', async () => {
      const db = await createTestDb();
      await createRow(db.id, {
        Name: { title: [{ type: 'text', text: { content: 'apple', link: null } }] },
      });
      await createRow(db.id, {
        Name: { title: [{ type: 'text', text: { content: 'banana', link: null } }] },
      });
      const res = await call(`/v1/databases/${db.id}/query`, {
        method: 'POST',
        body: JSON.stringify({
          filter: { property: 'Name', title: { contains: 'app' } },
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        results: { properties: { Name: { title: { plain_text: string }[] } } }[];
      };
      expect(body.results).toHaveLength(1);
    });

    it('filters by number greater_than', async () => {
      const db = await createTestDb();
      await createRow(db.id, {
        Name: { title: [{ type: 'text', text: { content: 'x', link: null } }] },
        Score: { number: 5 },
      });
      await createRow(db.id, {
        Name: { title: [{ type: 'text', text: { content: 'y', link: null } }] },
        Score: { number: 15 },
      });
      const res = await call(`/v1/databases/${db.id}/query`, {
        method: 'POST',
        body: JSON.stringify({
          filter: { property: 'Score', number: { greater_than: 10 } },
        }),
      });
      const body = (await res.json()) as { results: unknown[] };
      expect(body.results).toHaveLength(1);
    });

    it('compound and filter', async () => {
      const db = await createTestDb();
      await createRow(db.id, {
        Name: { title: [{ type: 'text', text: { content: 'x', link: null } }] },
        Score: { number: 5 },
        Done: { checkbox: true },
      });
      await createRow(db.id, {
        Name: { title: [{ type: 'text', text: { content: 'y', link: null } }] },
        Score: { number: 20 },
        Done: { checkbox: true },
      });
      await createRow(db.id, {
        Name: { title: [{ type: 'text', text: { content: 'z', link: null } }] },
        Score: { number: 30 },
        Done: { checkbox: false },
      });
      const res = await call(`/v1/databases/${db.id}/query`, {
        method: 'POST',
        body: JSON.stringify({
          filter: {
            and: [
              { property: 'Score', number: { greater_than: 10 } },
              { property: 'Done', checkbox: { equals: true } },
            ],
          },
        }),
      });
      const body = (await res.json()) as { results: unknown[] };
      expect(body.results).toHaveLength(1);
    });

    it('sorts by number descending', async () => {
      const db = await createTestDb();
      const a = await createRow(db.id, {
        Name: { title: [{ type: 'text', text: { content: 'a', link: null } }] },
        Score: { number: 1 },
      });
      const b = await createRow(db.id, {
        Name: { title: [{ type: 'text', text: { content: 'b', link: null } }] },
        Score: { number: 3 },
      });
      const c = await createRow(db.id, {
        Name: { title: [{ type: 'text', text: { content: 'c', link: null } }] },
        Score: { number: 2 },
      });
      const res = await call(`/v1/databases/${db.id}/query`, {
        method: 'POST',
        body: JSON.stringify({
          sorts: [{ property: 'Score', direction: 'descending' }],
        }),
      });
      const body = (await res.json()) as { results: { id: string }[] };
      expect(body.results.map((r) => r.id)).toEqual([b.id, c.id, a.id]);
    });

    it('paginates with start_cursor', async () => {
      const db = await createTestDb();
      for (let i = 0; i < 5; i++) {
        await createRow(db.id, {
          Name: { title: [{ type: 'text', text: { content: String(i), link: null } }] },
        });
      }
      const res1 = await call(`/v1/databases/${db.id}/query`, {
        method: 'POST',
        body: JSON.stringify({ page_size: 2 }),
      });
      const page1 = (await res1.json()) as {
        results: unknown[];
        next_cursor: string;
        has_more: boolean;
      };
      expect(page1.results).toHaveLength(2);
      expect(page1.has_more).toBe(true);

      const res2 = await call(`/v1/databases/${db.id}/query`, {
        method: 'POST',
        body: JSON.stringify({ page_size: 2, start_cursor: page1.next_cursor }),
      });
      const page2 = (await res2.json()) as { results: unknown[] };
      expect(page2.results).toHaveLength(2);
    });

    it('rejects unknown property in filter', async () => {
      const db = await createTestDb();
      const res = await call(`/v1/databases/${db.id}/query`, {
        method: 'POST',
        body: JSON.stringify({
          filter: { property: 'NotARealProperty', title: { equals: 'x' } },
        }),
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('PATCH /v1/databases/:id', () => {
    it('adds a new property', async () => {
      const db = await createTestDb();
      const res = await call(`/v1/databases/${db.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          properties: { Priority: { type: 'select', select: { options: [{ name: 'P0' }] } } },
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { properties: Record<string, unknown> };
      expect(Object.keys(body.properties)).toContain('Priority');
    });
  });
});
