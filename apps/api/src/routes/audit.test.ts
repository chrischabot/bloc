import { createUser, recordEvent } from '@bloc/db';
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

describe('audit log API', () => {
  it('lists events; owner has access', async () => {
    // Record a couple events directly.
    await recordEvent(h.handle.db, {
      workspaceId: h.workspaceId,
      actorUserId: h.userId,
      action: 'page.created',
      resourceType: 'page',
    });
    await recordEvent(h.handle.db, {
      workspaceId: h.workspaceId,
      actorUserId: h.userId,
      action: 'page.archived',
      resourceType: 'page',
    });
    const res = await call(`/v1/workspaces/${h.workspaceId}/audit_events`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { object: string; results: { action: string }[] };
    expect(body.object).toBe('list');
    expect(body.results.length).toBeGreaterThanOrEqual(2);
  });

  it('filters by action', async () => {
    await recordEvent(h.handle.db, {
      workspaceId: h.workspaceId,
      actorUserId: h.userId,
      action: 'page.created',
      resourceType: 'page',
    });
    await recordEvent(h.handle.db, {
      workspaceId: h.workspaceId,
      actorUserId: h.userId,
      action: 'page.archived',
      resourceType: 'page',
    });
    const res = await call(`/v1/workspaces/${h.workspaceId}/audit_events?action=page.archived`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: { action: string }[] };
    expect(body.results.every((r) => r.action === 'page.archived')).toBe(true);
  });

  it('rejects non-admin', async () => {
    // Add a plain member.
    const newUser = await createUser(h.handle.db, {
      email: `m${Date.now()}@local`,
      type: 'person',
    });
    await call(`/v1/workspaces/${h.workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: newUser.id, role: 'member' }),
    });
    const memberBearer = `Bearer test_${h.workspaceId}_${newUser.id}`;
    const res = await call(`/v1/workspaces/${h.workspaceId}/audit_events`, {
      bearer: memberBearer,
    });
    expect(res.status).toBe(403);
  });

  it('paginates with start_cursor', async () => {
    for (let i = 0; i < 5; i++) {
      await recordEvent(h.handle.db, {
        workspaceId: h.workspaceId,
        actorUserId: h.userId,
        action: `event.${i}`,
      });
    }
    const page1 = await call(`/v1/workspaces/${h.workspaceId}/audit_events?page_size=2`);
    const body1 = (await page1.json()) as {
      results: unknown[];
      has_more: boolean;
      next_cursor: string;
    };
    expect(body1.results).toHaveLength(2);
    expect(body1.has_more).toBe(true);

    const page2 = await call(
      `/v1/workspaces/${h.workspaceId}/audit_events?page_size=2&start_cursor=${encodeURIComponent(body1.next_cursor)}`,
    );
    const body2 = (await page2.json()) as { results: unknown[] };
    expect(body2.results).toHaveLength(2);
  });

  it('CSV export works for owner', async () => {
    await recordEvent(h.handle.db, {
      workspaceId: h.workspaceId,
      actorUserId: h.userId,
      action: 'csv.test',
    });
    const res = await call(`/v1/workspaces/${h.workspaceId}/audit_events:export.csv`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const text = await res.text();
    expect(text.split('\n')[0]).toContain('id,workspace_id');
  });

  it('rejects mismatched workspace id', async () => {
    const res = await call('/v1/workspaces/00000000-0000-0000-0000-000000000000/audit_events');
    expect(res.status).toBe(400);
  });
});
