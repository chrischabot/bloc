import { createUser } from '@bloc/db';
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
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const fetchInit: RequestInit = { headers };
  if (init.method !== undefined) fetchInit.method = init.method;
  if (init.body !== undefined) fetchInit.body = init.body;
  return h.app.request(BASE + path, fetchInit);
}

describe('integration tokens', () => {
  it('create + use + revoke', async () => {
    const create = await call('/v1/integrations', {
      method: 'POST',
      body: JSON.stringify({
        name: 'cli',
        workspace_id: h.workspaceId,
        capabilities: ['read_content', 'update_content'],
      }),
    });
    expect(create.status).toBe(200);
    const body = (await create.json()) as { id: string; token: string };
    expect(body.token).toMatch(/^secret_/);

    // The token authenticates real-bearer requests.
    const me = await call('/v1/users/me', { bearer: `Bearer ${body.token}` });
    expect(me.status).toBe(200);

    const list = await call('/v1/integrations');
    const listBody = (await list.json()) as { results: { id: string }[] };
    expect(listBody.results.some((r) => r.id === body.id)).toBe(true);

    const revoke = await call(`/v1/integrations/${body.id}`, { method: 'DELETE' });
    expect(revoke.status).toBe(204);

    // After revoke, the token no longer authenticates.
    const after = await call('/v1/users/me', { bearer: `Bearer ${body.token}` });
    expect(after.status).toBe(401);
  });

  it('rejects bad real-token bearer', async () => {
    const res = await call('/v1/users/me', {
      bearer: 'Bearer secret_invalid_example_token_for_unit_test_only',
    });
    expect(res.status).toBe(401);
  });
});

describe('workspace members', () => {
  it('owner lists members', async () => {
    const res = await call(`/v1/workspaces/${h.workspaceId}/members`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: { user_id: string; role: string }[] };
    expect(body.results.some((m) => m.user_id === h.userId && m.role === 'owner')).toBe(true);
  });

  it('owner adds and removes a member', async () => {
    const newUser = await createUser(h.handle.db, {
      email: `nu${Date.now()}@local`,
      name: 'New User',
      type: 'person',
    });
    const add = await call(`/v1/workspaces/${h.workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: newUser.id, role: 'member' }),
    });
    expect(add.status).toBe(204);

    const list = await call(`/v1/workspaces/${h.workspaceId}/members`);
    const listBody = (await list.json()) as { results: { user_id: string }[] };
    expect(listBody.results.some((m) => m.user_id === newUser.id)).toBe(true);

    const remove = await call(`/v1/workspaces/${h.workspaceId}/members/${newUser.id}`, {
      method: 'DELETE',
    });
    expect(remove.status).toBe(204);
  });

  it('rejects non-admin adding members', async () => {
    // Add a plain member.
    const newUser = await createUser(h.handle.db, {
      email: `nu2${Date.now()}@local`,
      type: 'person',
    });
    await call(`/v1/workspaces/${h.workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: newUser.id, role: 'member' }),
    });
    // Make a bearer for that user.
    const memberBearer = `Bearer test_${h.workspaceId}_${newUser.id}`;
    const res = await call(`/v1/workspaces/${h.workspaceId}/members`, {
      method: 'POST',
      bearer: memberBearer,
      body: JSON.stringify({ user_id: '00000000-0000-0000-0000-000000000000', role: 'member' }),
    });
    expect(res.status).toBe(403);
  });
});

describe('page permissions', () => {
  it('grants can_read to a user and resolves via .me', async () => {
    const newUser = await createUser(h.handle.db, {
      email: `nu3${Date.now()}@local`,
      type: 'person',
    });
    await call(`/v1/workspaces/${h.workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: newUser.id, role: 'guest' }),
    });
    const grant = await call(`/v1/pages/${h.page.id}/permissions`, {
      method: 'POST',
      body: JSON.stringify({
        grantee_type: 'user',
        grantee_id: newUser.id,
        level: 'can_read',
      }),
    });
    expect(grant.status).toBe(204);

    const list = await call(`/v1/pages/${h.page.id}/permissions`);
    expect(list.status).toBe(200);
    const body = (await list.json()) as { results: { grantee_id: string; level: string }[] };
    expect(body.results.some((p) => p.grantee_id === newUser.id && p.level === 'can_read')).toBe(
      true,
    );
  });

  it('rejects grant from non-full_access actor', async () => {
    const newUser = await createUser(h.handle.db, {
      email: `nu4${Date.now()}@local`,
      type: 'person',
    });
    await call(`/v1/workspaces/${h.workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: newUser.id, role: 'guest' }),
    });
    const res = await call(`/v1/pages/${h.page.id}/permissions`, {
      method: 'POST',
      bearer: `Bearer test_${h.workspaceId}_${newUser.id}`,
      body: JSON.stringify({
        grantee_type: 'user',
        grantee_id: newUser.id,
        level: 'can_read',
      }),
    });
    // 403 maps to 404 (hide-existence) per docs/api/02-errors.md.
    expect([403, 404]).toContain(res.status);
  });
});

describe('email magic link', () => {
  it('start + callback round-trip', async () => {
    const start = await h.app.request(`${BASE}/v1/auth/email/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'notion-version': LATEST_VERSION },
      body: JSON.stringify({ email: 'alice@example.com' }),
    });
    expect(start.status).toBe(200);
    const startBody = (await start.json()) as { token: string };
    expect(startBody.token).toBeTruthy();

    const cb = await h.app.request(
      `${BASE}/v1/auth/email/callback?token=${encodeURIComponent(startBody.token)}`,
      { headers: { 'notion-version': LATEST_VERSION } },
    );
    expect(cb.status).toBe(200);
    const cbBody = (await cb.json()) as { email: string };
    expect(cbBody.email).toBe('alice@example.com');
  });

  it('rejects expired/unknown token', async () => {
    const cb = await h.app.request(`${BASE}/v1/auth/email/callback?token=nope`, {
      headers: { 'notion-version': LATEST_VERSION },
    });
    expect(cb.status).toBe(400);
  });
});
