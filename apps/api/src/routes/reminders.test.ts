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
  if (init.body !== undefined) headers.set('content-type', 'application/json');
  const out: RequestInit = { headers };
  if (init.method !== undefined) out.method = init.method;
  if (init.body !== undefined) out.body = init.body;
  return h.app.request(BASE + path, out);
}

describe('reminders API', () => {
  it('creates a reminder on a page and lists it', async () => {
    const due = new Date(Date.now() + 60_000).toISOString();
    const res = await call('/v1/reminders', {
      method: 'POST',
      body: JSON.stringify({
        parent: { type: 'page', id: h.page.id },
        due_at: due,
        label: 'Buy milk',
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      object: string;
      id: string;
      label: string;
      fired: boolean;
    };
    expect(body.object).toBe('reminder');
    expect(body.label).toBe('Buy milk');
    expect(body.fired).toBe(false);

    const list = await call('/v1/reminders');
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as { results: { id: string }[] };
    expect(listBody.results.some((r) => r.id === body.id)).toBe(true);
  });

  it('retrieves a reminder by id', async () => {
    const create = await call('/v1/reminders', {
      method: 'POST',
      body: JSON.stringify({
        parent: { type: 'page', id: h.page.id },
        due_at: new Date(Date.now() + 60_000).toISOString(),
      }),
    });
    const { id } = (await create.json()) as { id: string };
    const get = await call(`/v1/reminders/${id}`);
    expect(get.status).toBe(200);
    const body = (await get.json()) as { id: string };
    expect(body.id).toBe(id);
  });

  it('marks a reminder fired', async () => {
    const create = await call('/v1/reminders', {
      method: 'POST',
      body: JSON.stringify({
        parent: { type: 'page', id: h.page.id },
        due_at: new Date(Date.now() + 60_000).toISOString(),
      }),
    });
    const { id } = (await create.json()) as { id: string };
    const fire = await call(`/v1/reminders/${id}/fire`, { method: 'POST' });
    expect(fire.status).toBe(200);
    const body = (await fire.json()) as { fired: boolean; fired_at: string };
    expect(body.fired).toBe(true);
    expect(body.fired_at).toMatch(/^\d{4}/);
  });

  it('deletes a reminder', async () => {
    const create = await call('/v1/reminders', {
      method: 'POST',
      body: JSON.stringify({
        parent: { type: 'page', id: h.page.id },
        due_at: new Date(Date.now() + 60_000).toISOString(),
      }),
    });
    const { id } = (await create.json()) as { id: string };
    const del = await call(`/v1/reminders/${id}`, { method: 'DELETE' });
    expect(del.status).toBe(204);
    const get = await call(`/v1/reminders/${id}`);
    expect(get.status).toBe(404);
  });

  it('admin scan-due returns due reminders', async () => {
    // Create a reminder due in the past so it's "due now".
    await call('/v1/reminders', {
      method: 'POST',
      body: JSON.stringify({
        parent: { type: 'page', id: h.page.id },
        due_at: new Date(Date.now() - 60_000).toISOString(),
      }),
    });
    const scan = await call('/v1/reminders/scan-due', { method: 'POST' });
    expect(scan.status).toBe(200);
    const body = (await scan.json()) as { results: unknown[]; now: string };
    expect(body.results.length).toBeGreaterThanOrEqual(1);
    expect(body.now).toMatch(/^\d{4}/);
  });

  it('scan-due rejects non-admin actors', async () => {
    const newUser = await createUser(h.handle.db, {
      email: `m${Date.now()}@local`,
      type: 'person',
    });
    await call(`/v1/workspaces/${h.workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: newUser.id, role: 'member' }),
    });
    const memberBearer = `Bearer test_${h.workspaceId}_${newUser.id}`;
    const res = await call('/v1/reminders/scan-due', {
      method: 'POST',
      bearer: memberBearer,
    });
    // restricted_resource hidden as 404 by error middleware.
    expect([403, 404]).toContain(res.status);
  });

  it('rejects malformed due_at', async () => {
    const res = await call('/v1/reminders', {
      method: 'POST',
      body: JSON.stringify({
        parent: { type: 'page', id: h.page.id },
        due_at: 'not-a-date',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown reminder', async () => {
    const res = await call('/v1/reminders/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('include_fired=true returns fired reminders', async () => {
    const create = await call('/v1/reminders', {
      method: 'POST',
      body: JSON.stringify({
        parent: { type: 'page', id: h.page.id },
        due_at: new Date(Date.now() + 60_000).toISOString(),
      }),
    });
    const { id } = (await create.json()) as { id: string };
    await call(`/v1/reminders/${id}/fire`, { method: 'POST' });

    const listOnly = await call('/v1/reminders');
    const listOnlyBody = (await listOnly.json()) as { results: unknown[] };
    expect(listOnlyBody.results).toHaveLength(0);

    const listAll = await call('/v1/reminders?include_fired=true');
    const listAllBody = (await listAll.json()) as { results: { id: string }[] };
    expect(listAllBody.results.some((r) => r.id === id)).toBe(true);
  });
});
