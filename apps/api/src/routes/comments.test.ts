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

async function createComment(): Promise<{ id: string; discussion_id: string }> {
  const res = await call('/v1/comments', {
    method: 'POST',
    body: JSON.stringify({
      parent: { page_id: h.page.id },
      rich_text: [{ type: 'text', text: { content: 'hello world', link: null } }],
    }),
  });
  expect(res.status).toBe(200);
  return (await res.json()) as { id: string; discussion_id: string };
}

describe('comments API', () => {
  it('creates a page comment + lists it', async () => {
    const body = await createComment();
    expect(body.id).toBeTruthy();
    expect(body.discussion_id).toBeTruthy();

    const list = await call(`/v1/comments?page_id=${h.page.id}`);
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as { results: unknown[] };
    expect(listBody.results).toHaveLength(1);
  });

  it('replies on a discussion', async () => {
    const first = await createComment();
    const reply = await call('/v1/comments', {
      method: 'POST',
      body: JSON.stringify({
        discussion_id: first.discussion_id,
        parent: { page_id: h.page.id },
        rich_text: [{ type: 'text', text: { content: 'reply', link: null } }],
      }),
    });
    expect(reply.status).toBe(200);
    const replyBody = (await reply.json()) as { discussion_id: string };
    expect(replyBody.discussion_id).toBe(first.discussion_id);
  });

  it('rejects missing parent', async () => {
    const res = await call('/v1/comments', {
      method: 'POST',
      body: JSON.stringify({ rich_text: [] }),
    });
    expect(res.status).toBe(400);
  });

  describe('reactions', () => {
    it('adds + lists a reaction', async () => {
      const c = await createComment();
      const res = await call(`/v1/comments/${c.id}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji: '👍' }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        reactions: { emoji: string; count: number; user_ids: string[] }[];
      };
      expect(body.reactions).toHaveLength(1);
      expect(body.reactions[0]!.emoji).toBe('👍');
      expect(body.reactions[0]!.count).toBe(1);
    });

    it('is idempotent on the same emoji', async () => {
      const c = await createComment();
      await call(`/v1/comments/${c.id}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji: '👍' }),
      });
      const res = await call(`/v1/comments/${c.id}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji: '👍' }),
      });
      const body = (await res.json()) as {
        reactions: { emoji: string; count: number }[];
      };
      expect(body.reactions).toHaveLength(1);
      expect(body.reactions[0]!.count).toBe(1);
    });

    it('multiple emoji are independent', async () => {
      const c = await createComment();
      await call(`/v1/comments/${c.id}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji: '👍' }),
      });
      await call(`/v1/comments/${c.id}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji: '🎉' }),
      });
      const list = await call(`/v1/comments?page_id=${h.page.id}`);
      const body = (await list.json()) as {
        results: { reactions: { emoji: string }[] }[];
      };
      expect(body.results[0]!.reactions.map((r) => r.emoji).sort()).toEqual(['👍', '🎉'].sort());
    });

    it('removes a reaction by emoji', async () => {
      const c = await createComment();
      await call(`/v1/comments/${c.id}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji: '👍' }),
      });
      const res = await call(`/v1/comments/${c.id}/reactions/${encodeURIComponent('👍')}`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { reactions: unknown[] };
      expect(body.reactions).toHaveLength(0);
    });

    it('404 on adding a reaction to an unknown comment', async () => {
      const res = await call('/v1/comments/00000000-0000-0000-0000-000000000000/reactions', {
        method: 'POST',
        body: JSON.stringify({ emoji: '👍' }),
      });
      expect(res.status).toBe(404);
    });

    it('rejects oversize emoji', async () => {
      const c = await createComment();
      const res = await call(`/v1/comments/${c.id}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji: 'a'.repeat(21) }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('resolve', () => {
    it('resolves the comment discussion', async () => {
      const c = await createComment();
      const res = await call(`/v1/comments/${c.id}/resolve`, { method: 'POST' });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { resolved: boolean; id: string };
      expect(body.resolved).toBe(true);
      expect(body.id).toBe(c.discussion_id);
    });

    it('404 on resolving an unknown comment', async () => {
      const res = await call('/v1/comments/00000000-0000-0000-0000-000000000000/resolve', {
        method: 'POST',
      });
      expect(res.status).toBe(404);
    });
  });
});
