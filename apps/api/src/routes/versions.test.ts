import { schema } from '@bloc/db';
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

async function insertUpdate(pageId: string, clock: number): Promise<void> {
  await h.handle.db.insert(schema.blockUpdates).values({
    pageId,
    clock,
    update: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
  });
}

describe('versions API', () => {
  it('GET /v1/pages/:id/versions returns empty list for a fresh page', async () => {
    const res = await call(`/v1/pages/${h.page.id}/versions`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: unknown[]; has_more: boolean };
    expect(body.results).toEqual([]);
    expect(body.has_more).toBe(false);
  });

  it('lists versions newest-first after inserting block_updates rows', async () => {
    await insertUpdate(h.page.id, 1);
    await insertUpdate(h.page.id, 2);
    await insertUpdate(h.page.id, 3);
    const res = await call(`/v1/pages/${h.page.id}/versions`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: { clock: number; update_bytes: number }[] };
    expect(body.results.map((r) => r.clock)).toEqual([3, 2, 1]);
    expect(body.results[0]!.update_bytes).toBe(4);
  });

  it('paginates with start_cursor', async () => {
    for (let i = 1; i <= 5; i++) await insertUpdate(h.page.id, i);
    const page1 = await call(`/v1/pages/${h.page.id}/versions?page_size=2`);
    const p1 = (await page1.json()) as {
      results: { clock: number }[];
      has_more: boolean;
      next_cursor: string;
    };
    expect(p1.results.map((r) => r.clock)).toEqual([5, 4]);
    expect(p1.has_more).toBe(true);
    const page2 = await call(
      `/v1/pages/${h.page.id}/versions?page_size=2&start_cursor=${encodeURIComponent(p1.next_cursor)}`,
    );
    const p2 = (await page2.json()) as { results: { clock: number }[] };
    expect(p2.results.map((r) => r.clock)).toEqual([3, 2]);
  });

  it('GET /v1/pages/:id/versions/:clock returns a snapshot envelope', async () => {
    await insertUpdate(h.page.id, 42);
    const res = await call(`/v1/pages/${h.page.id}/versions/42`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      object: string;
      clock: number;
      updates_through_clock: number;
      recordMap: Record<string, unknown>;
    };
    expect(body.object).toBe('page_version_snapshot');
    expect(body.clock).toBe(42);
    expect(body.updates_through_clock).toBe(1);
    expect(body.recordMap).toBeDefined();
  });

  it('404 on unknown version clock', async () => {
    const res = await call(`/v1/pages/${h.page.id}/versions/9999`);
    expect(res.status).toBe(404);
  });

  it('404 on non-integer clock', async () => {
    const res = await call(`/v1/pages/${h.page.id}/versions/not-a-number`);
    expect(res.status).toBe(404);
  });

  it('404 on unknown page id', async () => {
    const res = await call('/v1/pages/00000000-0000-0000-0000-000000000000/versions');
    expect(res.status).toBe(404);
  });
});
