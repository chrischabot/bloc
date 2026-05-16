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

async function createDb(): Promise<{ id: string }> {
  const res = await call('/v1/databases', {
    method: 'POST',
    body: JSON.stringify({
      parent: { type: 'page_id', page_id: h.page.id },
      title: [{ type: 'text', text: { content: 'Tasks', link: null } }],
      properties: { Name: { type: 'title', title: {} } },
    }),
  });
  return (await res.json()) as { id: string };
}

describe('data sources API', () => {
  it('every database starts with a default owned data source', async () => {
    const db = await createDb();
    const list = await call(`/v1/databases/${db.id}/data_sources`);
    expect(list.status).toBe(200);
    const body = (await list.json()) as { results: { type: string; name: string }[] };
    expect(body.results).toHaveLength(1);
    expect(body.results[0]!.type).toBe('owned');
    expect(body.results[0]!.name).toBe('Default');
  });

  it('creates an additional owned data source', async () => {
    const db = await createDb();
    const create = await call(`/v1/databases/${db.id}/data_sources`, {
      method: 'POST',
      body: JSON.stringify({ database_id: db.id, name: 'Archive', type: 'owned' }),
    });
    expect(create.status).toBe(200);
    const body = (await create.json()) as { name: string; type: string };
    expect(body.name).toBe('Archive');
    expect(body.type).toBe('owned');

    const list = await call(`/v1/databases/${db.id}/data_sources`);
    const listBody = (await list.json()) as { results: unknown[] };
    expect(listBody.results).toHaveLength(2);
  });

  it('retrieves a data source', async () => {
    const db = await createDb();
    const list = await call(`/v1/databases/${db.id}/data_sources`);
    const listBody = (await list.json()) as { results: { id: string }[] };
    const ds = listBody.results[0]!;
    const get = await call(`/v1/data_sources/${ds.id}`);
    expect(get.status).toBe(200);
    const body = (await get.json()) as { id: string; name: string };
    expect(body.id).toBe(ds.id);
  });

  it('queries a data source (default) — same results as database query', async () => {
    const db = await createDb();
    await call('/v1/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { type: 'database_id', database_id: db.id },
        properties: {
          Name: { title: [{ type: 'text', text: { content: 'row1', link: null } }] },
        },
      }),
    });
    const list = await call(`/v1/databases/${db.id}/data_sources`);
    const { results } = (await list.json()) as { results: { id: string }[] };
    const ds = results[0]!;
    const q = await call(`/v1/data_sources/${ds.id}/query`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(q.status).toBe(200);
    const body = (await q.json()) as { object: string; type: string; results: unknown[] };
    expect(body.object).toBe('list');
    expect(body.type).toBe('page_or_data_source');
    expect(body.results).toHaveLength(1);
  });

  it('creates a linked data source and rejects cycles', async () => {
    const dbA = await createDb();
    const dbB = await createDb();
    const aSources = await call(`/v1/databases/${dbA.id}/data_sources`);
    const aBody = (await aSources.json()) as { results: { id: string }[] };
    const upstreamId = aBody.results[0]!.id;

    const link = await call(`/v1/databases/${dbB.id}/data_sources`, {
      method: 'POST',
      body: JSON.stringify({
        database_id: dbB.id,
        name: 'A mirror',
        type: 'linked',
        source_data_source_id: upstreamId,
      }),
    });
    expect(link.status).toBe(200);
    const linkBody = (await link.json()) as {
      type: string;
      linked_from: { data_source_id: string };
    };
    expect(linkBody.type).toBe('linked');
    expect(linkBody.linked_from.data_source_id).toBe(upstreamId);

    // Now attempt to link to that linked source → cycle rejected.
    const linkedDsId = (linkBody as unknown as { id: string }).id;
    const cycle = await call(`/v1/databases/${dbA.id}/data_sources`, {
      method: 'POST',
      body: JSON.stringify({
        database_id: dbA.id,
        name: 'cycle',
        type: 'linked',
        source_data_source_id: linkedDsId,
      }),
    });
    expect(cycle.status).toBe(409);
  });

  it('rejects linked source without source_data_source_id', async () => {
    const db = await createDb();
    const res = await call(`/v1/databases/${db.id}/data_sources`, {
      method: 'POST',
      body: JSON.stringify({ database_id: db.id, name: 'bad', type: 'linked' }),
    });
    expect(res.status).toBe(400);
  });

  it('renames a data source via PATCH', async () => {
    const db = await createDb();
    const list = await call(`/v1/databases/${db.id}/data_sources`);
    const { results } = (await list.json()) as { results: { id: string }[] };
    const ds = results[0]!;
    const patch = await call(`/v1/data_sources/${ds.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Primary' }),
    });
    expect(patch.status).toBe(200);
    const body = (await patch.json()) as { name: string };
    expect(body.name).toBe('Primary');
  });

  it('DELETE archives the data source', async () => {
    const db = await createDb();
    const create = await call(`/v1/databases/${db.id}/data_sources`, {
      method: 'POST',
      body: JSON.stringify({ database_id: db.id, name: 'Extra', type: 'owned' }),
    });
    const { id } = (await create.json()) as { id: string };
    const del = await call(`/v1/data_sources/${id}`, { method: 'DELETE' });
    expect(del.status).toBe(204);

    const get = await call(`/v1/data_sources/${id}`);
    expect(get.status).toBe(404);
  });

  it('rejects mismatched database_id in body vs path', async () => {
    const dbA = await createDb();
    const dbB = await createDb();
    const res = await call(`/v1/databases/${dbA.id}/data_sources`, {
      method: 'POST',
      body: JSON.stringify({ database_id: dbB.id, name: 'x', type: 'owned' }),
    });
    expect(res.status).toBe(400);
  });
});
