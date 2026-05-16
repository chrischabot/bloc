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

describe('analytics API', () => {
  it('accepts a page_view beacon', async () => {
    const res = await call('/v1/analytics/beacon', {
      method: 'POST',
      body: JSON.stringify({ kind: 'page_view', page_id: h.page.id }),
    });
    expect(res.status).toBe(204);
  });

  it('accepts a web_vital beacon with metric + value', async () => {
    const res = await call('/v1/analytics/beacon', {
      method: 'POST',
      body: JSON.stringify({ kind: 'web_vital', metric: 'LCP', value: 1500 }),
    });
    expect(res.status).toBe(204);
  });

  it('rejects web_vital without metric or value', async () => {
    const res = await call('/v1/analytics/beacon', {
      method: 'POST',
      body: JSON.stringify({ kind: 'web_vital' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects ui_action without action', async () => {
    const res = await call('/v1/analytics/beacon', {
      method: 'POST',
      body: JSON.stringify({ kind: 'ui_action' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects unknown beacon kind', async () => {
    const res = await call('/v1/analytics/beacon', {
      method: 'POST',
      body: JSON.stringify({ kind: 'eyeball_jiggle' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects oversize value', async () => {
    const res = await call('/v1/analytics/beacon', {
      method: 'POST',
      body: JSON.stringify({ kind: 'web_vital', metric: 'LCP', value: 99_999_999 }),
    });
    expect(res.status).toBe(400);
  });

  it('admin lists events', async () => {
    await call('/v1/analytics/beacon', {
      method: 'POST',
      body: JSON.stringify({ kind: 'page_view', page_id: h.page.id }),
    });
    const list = await call('/v1/analytics/events');
    expect(list.status).toBe(200);
    const body = (await list.json()) as { results: unknown[] };
    expect(body.results.length).toBeGreaterThanOrEqual(1);
  });

  it('non-admin cannot list events', async () => {
    const newUser = await createUser(h.handle.db, {
      email: `m${Date.now()}@local`,
      type: 'person',
    });
    await call(`/v1/workspaces/${h.workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: newUser.id, role: 'member' }),
    });
    const memberBearer = `Bearer test_${h.workspaceId}_${newUser.id}`;
    const res = await call('/v1/analytics/events', { bearer: memberBearer });
    expect([403, 404]).toContain(res.status);
  });

  it('summary aggregates web vitals and counts page views', async () => {
    for (let i = 0; i < 3; i++) {
      await call('/v1/analytics/beacon', {
        method: 'POST',
        body: JSON.stringify({ kind: 'page_view', page_id: h.page.id }),
      });
    }
    for (const v of [200, 400, 800, 1200, 2000]) {
      await call('/v1/analytics/beacon', {
        method: 'POST',
        body: JSON.stringify({ kind: 'web_vital', metric: 'LCP', value: v }),
      });
    }
    await call('/v1/analytics/beacon', {
      method: 'POST',
      body: JSON.stringify({ kind: 'ui_action', action: 'page.opened' }),
    });
    const res = await call('/v1/analytics/summary');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      page_views: number;
      web_vitals: Record<string, { count: number; p50: number; p95: number }>;
      ui_actions: Record<string, number>;
    };
    expect(body.page_views).toBe(3);
    expect(body.web_vitals['LCP']!.count).toBe(5);
    expect(body.web_vitals['LCP']!.p50).toBeGreaterThan(0);
    expect(body.ui_actions['page.opened']).toBe(1);
  });

  it('summary filters by kind path', async () => {
    const res = await call('/v1/analytics/events?kind=not_a_kind');
    expect(res.status).toBe(400);
  });
});
