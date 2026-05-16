import { type TestHarness, bootTestHarness, closeHarness } from '@bloc/api/test-helpers';
import { schema } from '@bloc/db';
import { Bloc } from '@bloc/sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let h: TestHarness;

beforeEach(async () => {
  h = await bootTestHarness();
});
afterEach(async () => {
  await closeHarness(h);
});

const BASE = 'http://test.local';

function makeClient(): Bloc {
  return new Bloc({
    auth: h.bearer,
    baseUrl: BASE,
    fetch: async (input, init) =>
      h.app.request(typeof input === 'string' ? input : input.toString(), init ?? {}),
  });
}

describe('SDK-progressive: reminders / analytics / versions', () => {
  it('reminders: create + list + fire + delete', async () => {
    const client = makeClient();
    const r = await client.reminders.create({
      parent: { type: 'page', id: h.page.id },
      due_at: new Date(Date.now() + 60_000).toISOString(),
      label: 'Test reminder',
    });
    expect(r.object).toBe('reminder');
    const list = await client.reminders.list();
    expect(list.results.some((row) => row.id === r.id)).toBe(true);
    const fired = await client.reminders.fire({ reminder_id: r.id });
    expect(fired.fired).toBe(true);
    await client.reminders.delete({ reminder_id: r.id });
  });

  it('analytics: beacon + summary aggregates', async () => {
    const client = makeClient();
    await client.analytics.beacon({ kind: 'page_view', page_id: h.page.id });
    await client.analytics.beacon({ kind: 'web_vital', metric: 'INP', value: 150 });
    await client.analytics.beacon({ kind: 'ui_action', action: 'slash.open' });
    const summary = await client.analytics.summary();
    expect(summary.object).toBe('analytics_summary');
    expect(summary.page_views).toBeGreaterThanOrEqual(1);
    expect(summary.web_vitals['INP']!.count).toBeGreaterThanOrEqual(1);
    expect(summary.ui_actions['slash.open']).toBeGreaterThanOrEqual(1);
  });

  it('versions: list + retrieve snapshot', async () => {
    await h.handle.db.insert(schema.blockUpdates).values({
      pageId: h.page.id,
      clock: 7,
      update: new Uint8Array([1, 2, 3]),
    });
    const client = makeClient();
    const list = await client.versions.list({ page_id: h.page.id });
    expect(list.results.some((r) => r.clock === 7)).toBe(true);
    const snapshot = await client.versions.retrieve({ page_id: h.page.id, clock: 7 });
    expect(snapshot.object).toBe('page_version_snapshot');
    expect(snapshot.clock).toBe(7);
    expect(snapshot.updates_through_clock).toBeGreaterThanOrEqual(1);
  });
});
