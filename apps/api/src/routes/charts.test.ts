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

async function setupTasksDatabase(): Promise<{ id: string }> {
  const res = await call('/v1/databases', {
    method: 'POST',
    body: JSON.stringify({
      parent: { type: 'page_id', page_id: h.page.id },
      properties: {
        Name: { type: 'title', title: {} },
        Status: {
          type: 'select',
          select: {
            options: [
              { name: 'Todo', color: 'gray' },
              { name: 'In progress', color: 'blue' },
              { name: 'Done', color: 'green' },
            ],
          },
        },
        Score: { type: 'number', number: { format: 'number' } },
        Done: { type: 'checkbox', checkbox: {} },
      },
    }),
  });
  return (await res.json()) as { id: string };
}

async function addRow(
  dbId: string,
  values: { name: string; status: string; score: number; done: boolean },
): Promise<void> {
  await call('/v1/pages', {
    method: 'POST',
    body: JSON.stringify({
      parent: { type: 'database_id', database_id: dbId },
      properties: {
        Name: { title: [{ type: 'text', text: { content: values.name, link: null } }] },
        Status: { select: { name: values.status } },
        Score: { number: values.score },
        Done: { checkbox: values.done },
      },
    }),
  });
}

describe('charts endpoint', () => {
  it('number kind: count', async () => {
    const db = await setupTasksDatabase();
    await addRow(db.id, { name: 'a', status: 'Todo', score: 1, done: false });
    await addRow(db.id, { name: 'b', status: 'Done', score: 2, done: true });

    const res = await call('/v1/charts/evaluate', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'number',
        data_source: { database_id: db.id, aggregation: 'count' },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      object: string;
      kind: string;
      scalar: number;
      total: number;
    };
    expect(body.object).toBe('chart_result');
    expect(body.kind).toBe('number');
    expect(body.scalar).toBe(2);
    expect(body.total).toBe(2);
  });

  it('number kind: sum', async () => {
    const db = await setupTasksDatabase();
    await addRow(db.id, { name: 'a', status: 'Todo', score: 5, done: false });
    await addRow(db.id, { name: 'b', status: 'Done', score: 7, done: true });

    const res = await call('/v1/charts/evaluate', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'number',
        data_source: { database_id: db.id, y_property: 'Score', aggregation: 'sum' },
      }),
    });
    const body = (await res.json()) as { scalar: number };
    expect(body.scalar).toBe(12);
  });

  it('bar kind: groups by Status, counts rows', async () => {
    const db = await setupTasksDatabase();
    await addRow(db.id, { name: 'a', status: 'Todo', score: 1, done: false });
    await addRow(db.id, { name: 'b', status: 'Todo', score: 2, done: false });
    await addRow(db.id, { name: 'c', status: 'Done', score: 3, done: true });

    const res = await call('/v1/charts/evaluate', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'bar',
        data_source: { database_id: db.id, x_property: 'Status', aggregation: 'count' },
      }),
    });
    const body = (await res.json()) as {
      x_values: string[];
      series: Array<{ name: string; values: number[] }>;
    };
    expect([...body.x_values].sort()).toEqual(['Done', 'Todo']);
    expect(body.series).toHaveLength(1);
    const vals: Record<string, number> = {};
    body.x_values.forEach((x, i) => {
      vals[x] = body.series[0]!.values[i] ?? 0;
    });
    expect(vals).toEqual({ Todo: 2, Done: 1 });
  });

  it('bar kind with group_by produces multiple series', async () => {
    const db = await setupTasksDatabase();
    await addRow(db.id, { name: 'a', status: 'Todo', score: 1, done: false });
    await addRow(db.id, { name: 'b', status: 'Todo', score: 2, done: true });
    await addRow(db.id, { name: 'c', status: 'Done', score: 3, done: true });

    const res = await call('/v1/charts/evaluate', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'bar',
        data_source: {
          database_id: db.id,
          x_property: 'Status',
          group_by: 'Done',
          aggregation: 'count',
        },
      }),
    });
    const body = (await res.json()) as {
      x_values: string[];
      series: Array<{ name: string; values: Array<number | null> }>;
    };
    expect(body.series.length).toBeGreaterThanOrEqual(2);
    const names = body.series.map((s) => s.name).sort();
    expect(names).toEqual(['false', 'true']);
  });

  it('pie kind: counts rows per status', async () => {
    const db = await setupTasksDatabase();
    await addRow(db.id, { name: 'a', status: 'Todo', score: 1, done: false });
    await addRow(db.id, { name: 'b', status: 'Done', score: 2, done: true });

    const res = await call('/v1/charts/evaluate', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'pie',
        data_source: { database_id: db.id, x_property: 'Status', aggregation: 'count' },
      }),
    });
    const body = (await res.json()) as { kind: string; x_values: string[] };
    expect(body.kind).toBe('pie');
    expect(body.x_values.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty series for empty database', async () => {
    const db = await setupTasksDatabase();
    const res = await call('/v1/charts/evaluate', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'bar',
        data_source: { database_id: db.id, x_property: 'Status', aggregation: 'count' },
      }),
    });
    const body = (await res.json()) as {
      total: number;
      x_values: string[];
      series: unknown[];
    };
    expect(body.total).toBe(0);
    expect(body.x_values).toEqual([]);
    expect(body.series).toEqual([]);
  });

  it('404 on unknown database', async () => {
    const res = await call('/v1/charts/evaluate', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'number',
        data_source: {
          database_id: '00000000-0000-0000-0000-000000000000',
          aggregation: 'count',
        },
      }),
    });
    expect(res.status).toBe(404);
  });

  it('rejects unknown chart kind', async () => {
    const db = await setupTasksDatabase();
    const res = await call('/v1/charts/evaluate', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'tornado',
        data_source: { database_id: db.id, aggregation: 'count' },
      }),
    });
    expect(res.status).toBe(400);
  });

  it('applies data_source.filter to the underlying database query', async () => {
    const db = await setupTasksDatabase();
    await addRow(db.id, { name: 'a', status: 'Todo', score: 1, done: false });
    await addRow(db.id, { name: 'b', status: 'Todo', score: 2, done: false });
    await addRow(db.id, { name: 'c', status: 'Done', score: 3, done: true });

    const res = await call('/v1/charts/evaluate', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'number',
        data_source: {
          database_id: db.id,
          aggregation: 'count',
          filter: { property: 'Done', checkbox: { equals: true } },
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { scalar: number };
    expect(body.scalar).toBe(1);
  });
});
