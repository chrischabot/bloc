import { LATEST_VERSION } from '@bloc/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { realtimeBus } from '../realtime/bus.ts';
import { type TestHarness, bootTestHarness, closeHarness } from '../test-helpers.ts';

let h: TestHarness;

beforeEach(async () => {
  realtimeBus.reset();
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

describe('realtime API', () => {
  it('publishes block.appended events on block create', async () => {
    await call(`/v1/blocks/${h.page.id}/children`, {
      method: 'PATCH',
      body: JSON.stringify({
        children: [{ type: 'paragraph', paragraph: { rich_text: [], color: 'default' } }],
      }),
    });
    const poll = await call(`/v1/realtime/pages/${h.page.id}?since=0`);
    expect(poll.status).toBe(200);
    const body = (await poll.json()) as { results: { type: string }[] };
    expect(body.results.some((r) => r.type === 'block.appended')).toBe(true);
  });

  it('long-poll wait returns immediately when there are pending events', async () => {
    // Publish first.
    await call(`/v1/blocks/${h.page.id}/children`, {
      method: 'PATCH',
      body: JSON.stringify({
        children: [{ type: 'paragraph', paragraph: { rich_text: [], color: 'default' } }],
      }),
    });
    const res = await call(`/v1/realtime/pages/${h.page.id}/wait`, {
      method: 'POST',
      body: JSON.stringify({ since: 0, timeout_ms: 500 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: unknown[] };
    expect(body.results.length).toBeGreaterThanOrEqual(1);
  });

  it('long-poll wait returns empty results on timeout', async () => {
    const res = await call(`/v1/realtime/pages/${h.page.id}/wait`, {
      method: 'POST',
      body: JSON.stringify({ since: 0, timeout_ms: 100 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: unknown[] };
    expect(body.results).toHaveLength(0);
  });

  it('long-poll wait wakes on a publish during the wait window', async () => {
    const pollPromise = call(`/v1/realtime/pages/${h.page.id}/wait`, {
      method: 'POST',
      body: JSON.stringify({ since: 0, timeout_ms: 5000 }),
    });
    // Concurrently publish.
    await new Promise((r) => setTimeout(r, 50));
    await call(`/v1/blocks/${h.page.id}/children`, {
      method: 'PATCH',
      body: JSON.stringify({
        children: [{ type: 'paragraph', paragraph: { rich_text: [], color: 'default' } }],
      }),
    });
    const res = await pollPromise;
    const body = (await res.json()) as { results: { type: string }[] };
    expect(body.results.length).toBeGreaterThanOrEqual(1);
    expect(body.results[0]!.type).toBe('block.appended');
  });

  it('404 on unknown page', async () => {
    const res = await call('/v1/realtime/pages/00000000-0000-0000-0000-000000000000?since=0');
    expect(res.status).toBe(404);
  });

  it('rejects non-numeric since query', async () => {
    const res = await call(`/v1/realtime/pages/${h.page.id}?since=abc`);
    expect(res.status).toBe(400);
  });
});
