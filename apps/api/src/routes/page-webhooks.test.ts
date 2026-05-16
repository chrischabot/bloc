import { recordEvent } from '@bloc/db';
import { LATEST_VERSION } from '@bloc/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type TestHarness, bootTestHarness, closeHarness } from '../test-helpers.ts';

interface RecordedDelivery {
  url: string;
  body: { type: string; data?: Record<string, unknown> };
}

let h: TestHarness;
let deliveries: RecordedDelivery[] = [];

const recordFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const body = typeof init?.body === 'string' ? init.body : '';
  let parsed: { type: string; data?: Record<string, unknown> } = { type: 'unknown' };
  try {
    parsed = JSON.parse(body) as typeof parsed;
  } catch {
    // Ignore non-JSON bodies.
  }
  deliveries.push({ url, body: parsed });
  if (parsed.type === 'verification') {
    return new Response(JSON.stringify({ token: (parsed as { token?: string }).token }), {
      status: 200,
    });
  }
  return new Response('', { status: 200 });
};

beforeEach(async () => {
  deliveries = [];
  h = await bootTestHarness({ webhookFetch: recordFetch });
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

async function registerWebhook(events: string[]): Promise<void> {
  const res = await call('/v1/webhooks', {
    method: 'POST',
    body: JSON.stringify({
      endpoint_url: 'https://receiver.example.com/hook',
      subscribed_events: events,
    }),
  });
  expect(res.status).toBe(200);
  // Drop verification deliveries so subsequent assertions only count business events.
  deliveries = deliveries.filter((d) => d.body.type !== 'verification');
}

async function waitForEvent(type: string, timeoutMs = 200): Promise<RecordedDelivery | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const hit = deliveries.find((d) => d.body.type === type);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 10));
  }
  return null;
}

describe('page lifecycle webhook events', () => {
  it('emits page.created on POST /v1/pages', async () => {
    await registerWebhook(['page.created']);
    const res = await call('/v1/pages', {
      method: 'POST',
      body: JSON.stringify({ parent: { type: 'workspace', workspace: true } }),
    });
    expect(res.status).toBe(200);
    expect(await waitForEvent('page.created')).not.toBeNull();
  });

  it('emits page.updated on a PATCH that mutates icon/cover', async () => {
    await registerWebhook(['page.created', 'page.updated']);
    const create = await call('/v1/pages', {
      method: 'POST',
      body: JSON.stringify({ parent: { type: 'workspace', workspace: true } }),
    });
    const { id } = (await create.json()) as { id: string };
    await waitForEvent('page.created');
    deliveries = deliveries.filter((d) => d.body.type !== 'page.created');

    const patch = await call(`/v1/pages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ icon: { type: 'emoji', emoji: '🚀' } }),
    });
    expect(patch.status).toBe(200);
    expect(await waitForEvent('page.updated')).not.toBeNull();
  });

  it('emits page.archived on PATCH archived=true and page.unarchived on archived=false', async () => {
    await registerWebhook(['page.archived', 'page.unarchived', 'page.created', 'page.updated']);
    const create = await call('/v1/pages', {
      method: 'POST',
      body: JSON.stringify({ parent: { type: 'workspace', workspace: true } }),
    });
    const { id } = (await create.json()) as { id: string };

    await call(`/v1/pages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ archived: true }),
    });
    expect(await waitForEvent('page.archived')).not.toBeNull();

    await call(`/v1/pages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ archived: false }),
    });
    expect(await waitForEvent('page.unarchived')).not.toBeNull();
  });

  it('emits page.deleted on permanent delete after archive', async () => {
    // page.deleted is an extension to the documented catalogue for permanent
    // removal; subscribe to it explicitly.
    await registerWebhook(['page.archived', 'page.deleted']);
    const create = await call('/v1/pages', {
      method: 'POST',
      body: JSON.stringify({ parent: { type: 'workspace', workspace: true } }),
    });
    const { id } = (await create.json()) as { id: string };

    await call(`/v1/pages/${id}`, { method: 'DELETE' });
    expect(await waitForEvent('page.archived')).not.toBeNull();
    deliveries = deliveries.filter((d) => d.body.type !== 'page.archived');

    const hard = await call(`/v1/pages/${id}?permanent=true`, { method: 'DELETE' });
    expect(hard.status).toBe(204);
    expect(await waitForEvent('page.deleted')).not.toBeNull();
  });

  it('records an audit event when an admin scans due reminders', async () => {
    // Sanity that the audit log captures admin scan events as the worker would.
    await recordEvent(h.handle.db, {
      workspaceId: h.workspaceId,
      actorUserId: h.userId,
      action: 'reminder.scan-due',
    });
    const res = await call(`/v1/workspaces/${h.workspaceId}/audit_events?action=reminder.scan-due`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: { action: string }[] };
    expect(body.results.some((r) => r.action === 'reminder.scan-due')).toBe(true);
  });
});
