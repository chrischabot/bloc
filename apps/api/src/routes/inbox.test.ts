import { addMember, createUser } from '@bloc/db';
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

async function call(path: string, init: RequestInit & { bearer?: string } = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('authorization', init.bearer ?? h.bearer);
  headers.set('notion-version', LATEST_VERSION);
  if (init.body !== undefined) headers.set('content-type', 'application/json');
  const out: RequestInit = { headers };
  if (init.method !== undefined) out.method = init.method;
  if (init.body !== undefined) out.body = init.body;
  return h.app.request(BASE + path, out);
}

describe('inbox endpoint', () => {
  it('returns empty list for a fresh actor', async () => {
    const res = await call('/v1/inbox');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { object: string; results: unknown[] };
    expect(body.object).toBe('list');
    expect(body.results).toHaveLength(0);
  });

  it('surfaces a comment on a page the actor created (kind=comment)', async () => {
    const other = await createUser(h.handle.db, { email: `o${Date.now()}@local`, type: 'person' });
    await addMember(h.handle.db, { workspaceId: h.workspaceId, userId: other.id, role: 'member' });
    await call(`/v1/pages/${h.page.id}/permissions`, {
      method: 'POST',
      body: JSON.stringify({ grantee_type: 'user', grantee_id: other.id, level: 'can_comment' }),
    });
    const otherBearer = `Bearer test_${h.workspaceId}_${other.id}`;
    const create = await call('/v1/comments', {
      method: 'POST',
      bearer: otherBearer,
      body: JSON.stringify({
        parent: { page_id: h.page.id },
        rich_text: [{ type: 'text', text: { content: 'hi', link: null } }],
      }),
    });
    expect(create.status).toBe(200);

    const inbox = await call('/v1/inbox?kind=comment');
    expect(inbox.status).toBe(200);
    const body = (await inbox.json()) as { results: { kind: string; actor_user_id: string }[] };
    expect(body.results.some((r) => r.kind === 'comment' && r.actor_user_id === other.id)).toBe(
      true,
    );
  });

  it('surfaces an @user mention in a comment as kind=mention', async () => {
    const other = await createUser(h.handle.db, { email: `o${Date.now()}@local`, type: 'person' });
    await addMember(h.handle.db, { workspaceId: h.workspaceId, userId: other.id, role: 'member' });
    await call(`/v1/pages/${h.page.id}/permissions`, {
      method: 'POST',
      body: JSON.stringify({ grantee_type: 'user', grantee_id: other.id, level: 'can_comment' }),
    });
    const otherBearer = `Bearer test_${h.workspaceId}_${other.id}`;
    await call('/v1/comments', {
      method: 'POST',
      bearer: otherBearer,
      body: JSON.stringify({
        parent: { page_id: h.page.id },
        rich_text: [
          {
            type: 'mention',
            mention: { type: 'user', user: { id: h.userId } },
            plain_text: '@you',
            href: null,
            annotations: {},
          },
        ],
      }),
    });
    const inbox = await call('/v1/inbox?kind=mention');
    const body = (await inbox.json()) as { results: { kind: string }[] };
    expect(body.results.some((r) => r.kind === 'mention')).toBe(true);
  });

  it('surfaces page_update notifications by other users on actor-owned pages', async () => {
    const other = await createUser(h.handle.db, { email: `o${Date.now()}@local`, type: 'person' });
    await addMember(h.handle.db, { workspaceId: h.workspaceId, userId: other.id, role: 'member' });
    const otherBearer = `Bearer test_${h.workspaceId}_${other.id}`;
    const grant = await call(`/v1/pages/${h.page.id}/permissions`, {
      method: 'POST',
      body: JSON.stringify({ grantee_type: 'user', grantee_id: other.id, level: 'can_edit' }),
    });
    expect(grant.status).toBe(204);
    const patch = await call(`/v1/pages/${h.page.id}`, {
      method: 'PATCH',
      bearer: otherBearer,
      body: JSON.stringify({ icon: { type: 'emoji', emoji: '🎯' } }),
    });
    expect(patch.status).toBe(200);

    const inbox = await call('/v1/inbox?kind=page_update');
    const body = (await inbox.json()) as {
      results: { kind: string; target_page_id: string; actor_user_id: string }[];
    };
    expect(
      body.results.some(
        (r) =>
          r.kind === 'page_update' &&
          r.target_page_id === h.page.id &&
          r.actor_user_id === other.id,
      ),
    ).toBe(true);
  });

  it('respects since param', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const res = await call(`/v1/inbox?since=${encodeURIComponent(future)}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: unknown[] };
    expect(body.results).toHaveLength(0);
  });

  it('rejects invalid since', async () => {
    const res = await call('/v1/inbox?since=not-a-date');
    expect(res.status).toBe(400);
  });

  it('rejects oversized page_size', async () => {
    const res = await call('/v1/inbox?page_size=999');
    expect(res.status).toBe(400);
  });
});
