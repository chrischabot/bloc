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

async function setupFormulaDb(): Promise<{ id: string }> {
  const res = await call('/v1/databases', {
    method: 'POST',
    body: JSON.stringify({
      parent: { type: 'page_id', page_id: h.page.id },
      properties: {
        Name: { type: 'title', title: {} },
        Score: { type: 'number', number: {} },
        Doubled: { type: 'formula', formula: { expression: 'prop("Score") * 2' } },
        Label: {
          type: 'formula',
          formula: { expression: 'if(prop("Score") >= 5, "high", "low")' },
        },
      },
    }),
  });
  const body = (await res.json()) as { id: string };
  return body;
}

async function addRow(databaseId: string, name: string, score: number): Promise<void> {
  await call('/v1/pages', {
    method: 'POST',
    body: JSON.stringify({
      parent: { type: 'database_id', database_id: databaseId },
      properties: {
        Name: { title: [{ type: 'text', text: { content: name, link: null } }] },
        Score: { number: score },
      },
    }),
  });
}

describe('formula filters', () => {
  it('filters by formula > number', async () => {
    const db = await setupFormulaDb();
    await addRow(db.id, 'a', 1);
    await addRow(db.id, 'b', 3);
    await addRow(db.id, 'c', 10);
    const res = await call(`/v1/databases/${db.id}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter: { property: 'Doubled', formula: { number: { greater_than: 5 } } },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: { properties: { Name: unknown } }[] };
    expect(body.results).toHaveLength(2); // b (6) and c (20)
  });

  it('filters by formula equals string', async () => {
    const db = await setupFormulaDb();
    await addRow(db.id, 'a', 2);
    await addRow(db.id, 'b', 5);
    await addRow(db.id, 'c', 10);
    const res = await call(`/v1/databases/${db.id}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter: { property: 'Label', formula: { string: { equals: 'high' } } },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: unknown[] };
    expect(body.results).toHaveLength(2); // b and c
  });

  it('filters by formula number equals zero', async () => {
    const db = await setupFormulaDb();
    await addRow(db.id, 'a', 0); // doubled = 0
    await addRow(db.id, 'b', 4); // doubled = 8
    const res = await call(`/v1/databases/${db.id}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter: { property: 'Doubled', formula: { number: { equals: 0 } } },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: unknown[] };
    expect(body.results).toHaveLength(1);
  });

  it('handles division-by-zero gracefully without crashing the query', async () => {
    // Create a separate db with a formula that divides by zero.
    const res = await call('/v1/databases', {
      method: 'POST',
      body: JSON.stringify({
        parent: { type: 'page_id', page_id: h.page.id },
        properties: {
          Name: { type: 'title', title: {} },
          Score: { type: 'number', number: {} },
          Bad: { type: 'formula', formula: { expression: 'divide(prop("Score"), 0)' } },
        },
      }),
    });
    const dbBody = (await res.json()) as { id: string };
    await addRow(dbBody.id, 'a', 5);
    const query = await call(`/v1/databases/${dbBody.id}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter: { property: 'Bad', formula: { number: { greater_than: 0 } } },
      }),
    });
    expect(query.status).toBe(200);
    const body = (await query.json()) as { results: unknown[] };
    expect(body.results).toEqual([]); // formula errored → no matches
  });

  it('sorts by formula property ascending', async () => {
    const db = await setupFormulaDb();
    await addRow(db.id, 'a', 3);
    await addRow(db.id, 'b', 1);
    await addRow(db.id, 'c', 2);
    const res = await call(`/v1/databases/${db.id}/query`, {
      method: 'POST',
      body: JSON.stringify({
        sorts: [{ property: 'Doubled', direction: 'ascending' }],
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      results: { properties: { Name: { title: Array<{ plain_text: string }> } } }[];
    };
    const names = body.results.map((r) => r.properties.Name.title[0]!.plain_text);
    expect(names).toEqual(['b', 'c', 'a']);
  });
});
