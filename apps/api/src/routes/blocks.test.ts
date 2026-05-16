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

describe('blocks API', () => {
  describe('PATCH /v1/blocks/:id/children', () => {
    it('appends a paragraph and returns it', async () => {
      const res = await call(`/v1/blocks/${h.page.id}/children`, {
        method: 'PATCH',
        body: JSON.stringify({
          children: [
            {
              type: 'paragraph',
              paragraph: {
                rich_text: [{ type: 'text', text: { content: 'Hello', link: null } }],
                color: 'default',
              },
            },
          ],
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { object: string; results: unknown[]; has_more: boolean };
      expect(body.object).toBe('list');
      expect(body.results).toHaveLength(1);
      expect(body.has_more).toBe(false);
    });

    it('rejects oversize children array (>100)', async () => {
      const children = Array.from({ length: 101 }, () => ({
        type: 'paragraph',
        paragraph: { rich_text: [], color: 'default' },
      }));
      const res = await call(`/v1/blocks/${h.page.id}/children`, {
        method: 'PATCH',
        body: JSON.stringify({ children }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('invalid_request');
    });

    it('rejects type/payload mismatch', async () => {
      const res = await call(`/v1/blocks/${h.page.id}/children`, {
        method: 'PATCH',
        body: JSON.stringify({
          children: [{ type: 'paragraph', heading_1: { rich_text: [] } }],
        }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 401 without a bearer', async () => {
      const res = await h.app.request(`${BASE}/v1/blocks/${h.page.id}/children`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'notion-version': LATEST_VERSION },
        body: JSON.stringify({ children: [] }),
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 on unsupported Notion-Version', async () => {
      const res = await h.app.request(`${BASE}/v1/blocks/${h.page.id}/children`, {
        method: 'PATCH',
        headers: {
          authorization: h.bearer,
          'content-type': 'application/json',
          'notion-version': '1999-01-01',
        },
        body: JSON.stringify({ children: [] }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /v1/blocks/:id/children', () => {
    it('lists with pagination', async () => {
      // Insert 5 children.
      await call(`/v1/blocks/${h.page.id}/children`, {
        method: 'PATCH',
        body: JSON.stringify({
          children: Array.from({ length: 5 }, (_, i) => ({
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: `block${i}`, link: null } }],
              color: 'default',
            },
          })),
        }),
      });
      const res = await call(`/v1/blocks/${h.page.id}/children?page_size=3`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        results: unknown[];
        has_more: boolean;
        next_cursor: string | null;
      };
      expect(body.results).toHaveLength(3);
      expect(body.has_more).toBe(true);
      expect(body.next_cursor).not.toBeNull();
    });
  });

  describe('GET /v1/blocks/:id', () => {
    it('retrieves a specific block', async () => {
      const appendRes = await call(`/v1/blocks/${h.page.id}/children`, {
        method: 'PATCH',
        body: JSON.stringify({
          children: [
            {
              type: 'paragraph',
              paragraph: {
                rich_text: [{ type: 'text', text: { content: 'fetch me', link: null } }],
                color: 'default',
              },
            },
          ],
        }),
      });
      const appended = (await appendRes.json()) as { results: { id: string }[] };
      const blockId = appended.results[0]!.id;
      const res = await call(`/v1/blocks/${blockId}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { object: string; type: string; id: string };
      expect(body.object).toBe('block');
      expect(body.type).toBe('paragraph');
      expect(body.id).toBe(blockId);
    });

    it('returns 404 for unknown id', async () => {
      const res = await call('/v1/blocks/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /v1/blocks/:id', () => {
    it('updates the rich_text of a paragraph', async () => {
      const append = await call(`/v1/blocks/${h.page.id}/children`, {
        method: 'PATCH',
        body: JSON.stringify({
          children: [
            {
              type: 'paragraph',
              paragraph: { rich_text: [], color: 'default' },
            },
          ],
        }),
      });
      const { results } = (await append.json()) as { results: { id: string }[] };
      const blockId = results[0]!.id;
      const update = await call(`/v1/blocks/${blockId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          paragraph: {
            rich_text: [{ type: 'text', text: { content: 'updated', link: null } }],
            color: 'gray',
          },
        }),
      });
      expect(update.status).toBe(200);
      const body = (await update.json()) as { paragraph: { color: string; rich_text: unknown[] } };
      expect(body.paragraph.color).toBe('gray');
      expect(body.paragraph.rich_text).toHaveLength(1);
    });
  });

  describe('DELETE /v1/blocks/:id', () => {
    it('archives the block', async () => {
      const append = await call(`/v1/blocks/${h.page.id}/children`, {
        method: 'PATCH',
        body: JSON.stringify({
          children: [
            {
              type: 'paragraph',
              paragraph: { rich_text: [], color: 'default' },
            },
          ],
        }),
      });
      const { results } = (await append.json()) as { results: { id: string }[] };
      const blockId = results[0]!.id;
      const del = await call(`/v1/blocks/${blockId}`, { method: 'DELETE' });
      expect(del.status).toBe(200);
      const body = (await del.json()) as { archived: boolean; in_trash: boolean };
      expect(body.archived).toBe(true);
      expect(body.in_trash).toBe(true);

      const after = await call(`/v1/blocks/${blockId}`);
      expect(after.status).toBe(404);
    });
  });

  describe('headers', () => {
    it('attaches x-request-id and notion-version on every response', async () => {
      const res = await call(`/v1/blocks/${h.page.id}/children`);
      expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.headers.get('notion-version')).toBe(LATEST_VERSION);
    });
  });
});
