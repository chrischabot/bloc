import { createDatabase, createProperty, schema } from '@bloc/db';
import { LATEST_VERSION } from '@bloc/shared';
import { eq } from 'drizzle-orm';
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

interface DualRelationSetup {
  dbA: string;
  dbB: string;
  relationOnA: { id: string };
  inverseOnB: { id: string };
}

/**
 * Create two databases A and B. Add a title to each, plus:
 * - On A: a dual_property relation `LinkToB` whose target is database B.
 * - On B: a relation `LinkedFromA` whose config carries the inverse pointer to LinkToB.
 *
 * The repository layer is sufficient for the schema-level wiring; the routes
 * call `syncDualRelation` whenever a relation value is written.
 */
async function setupDualRelation(): Promise<DualRelationSetup> {
  const dbA = await createDatabase(h.handle.db, {
    workspaceId: h.workspaceId,
    parentType: 'page',
    parentId: h.page.id,
    title: [],
    description: [],
    createdBy: h.userId,
    lastEditedBy: h.userId,
  });
  const dbB = await createDatabase(h.handle.db, {
    workspaceId: h.workspaceId,
    parentType: 'page',
    parentId: h.page.id,
    title: [],
    description: [],
    createdBy: h.userId,
    lastEditedBy: h.userId,
  });
  await createProperty(h.handle.db, {
    databaseId: dbA.id,
    name: 'Name',
    type: 'title',
  });
  await createProperty(h.handle.db, {
    databaseId: dbB.id,
    name: 'Name',
    type: 'title',
  });

  // First create the inverse property on B (it carries the synced_property_id back).
  const inverseOnB = await createProperty(h.handle.db, {
    databaseId: dbB.id,
    name: 'LinkedFromA',
    type: 'relation',
    config: {
      database_id: dbA.id,
      type: 'dual_property',
      dual_property: { synced_property_id: '', synced_property_name: 'LinkToB' },
    },
  });
  // Then create the relation on A, pointing back at the inverse.
  const relationOnA = await createProperty(h.handle.db, {
    databaseId: dbA.id,
    name: 'LinkToB',
    type: 'relation',
    config: {
      database_id: dbB.id,
      type: 'dual_property',
      dual_property: {
        synced_property_id: inverseOnB.id,
        synced_property_name: 'LinkedFromA',
      },
    },
  });
  // Patch the inverse to reference the relation we just made.
  await h.handle.db
    .update(schema.databaseProperties)
    .set({
      config: {
        database_id: dbA.id,
        type: 'dual_property',
        dual_property: {
          synced_property_id: relationOnA.id,
          synced_property_name: 'LinkToB',
        },
      } as Record<string, unknown>,
    })
    .where(eq(schema.databaseProperties.id, inverseOnB.id));

  return { dbA: dbA.id, dbB: dbB.id, relationOnA, inverseOnB };
}

async function newRow(databaseId: string, name: string): Promise<string> {
  const res = await call('/v1/pages', {
    method: 'POST',
    body: JSON.stringify({
      parent: { type: 'database_id', database_id: databaseId },
      properties: {
        Name: { title: [{ type: 'text', text: { content: name, link: null } }] },
      },
    }),
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function getRelation(pageId: string, propertyId: string): Promise<string[]> {
  const res = await call(`/v1/pages/${pageId}/properties/${propertyId}`);
  expect(res.status).toBe(200);
  const body = (await res.json()) as {
    relation?: Array<{ id: string }>;
  };
  return (body.relation ?? []).map((r) => r.id);
}

describe('dual_property relation bidirectional sync', () => {
  it('mirrors a single added ref to the inverse property', async () => {
    const setup = await setupDualRelation();
    const a1 = await newRow(setup.dbA, 'A1');
    const b1 = await newRow(setup.dbB, 'B1');

    await call(`/v1/pages/${a1}`, {
      method: 'PATCH',
      body: JSON.stringify({
        properties: {
          LinkToB: { relation: [{ id: b1 }] },
        },
      }),
    });

    expect(await getRelation(a1, setup.relationOnA.id)).toEqual([b1]);
    expect(await getRelation(b1, setup.inverseOnB.id)).toEqual([a1]);
  });

  it('mirrors a second add (multiple refs)', async () => {
    const setup = await setupDualRelation();
    const a1 = await newRow(setup.dbA, 'A1');
    const b1 = await newRow(setup.dbB, 'B1');
    const b2 = await newRow(setup.dbB, 'B2');

    await call(`/v1/pages/${a1}`, {
      method: 'PATCH',
      body: JSON.stringify({
        properties: { LinkToB: { relation: [{ id: b1 }] } },
      }),
    });
    await call(`/v1/pages/${a1}`, {
      method: 'PATCH',
      body: JSON.stringify({
        properties: { LinkToB: { relation: [{ id: b1 }, { id: b2 }] } },
      }),
    });

    expect(await getRelation(a1, setup.relationOnA.id)).toEqual([b1, b2]);
    expect(await getRelation(b1, setup.inverseOnB.id)).toEqual([a1]);
    expect(await getRelation(b2, setup.inverseOnB.id)).toEqual([a1]);
  });

  it('mirrors a removal', async () => {
    const setup = await setupDualRelation();
    const a1 = await newRow(setup.dbA, 'A1');
    const b1 = await newRow(setup.dbB, 'B1');
    const b2 = await newRow(setup.dbB, 'B2');

    await call(`/v1/pages/${a1}`, {
      method: 'PATCH',
      body: JSON.stringify({
        properties: { LinkToB: { relation: [{ id: b1 }, { id: b2 }] } },
      }),
    });
    // Now remove b1.
    await call(`/v1/pages/${a1}`, {
      method: 'PATCH',
      body: JSON.stringify({
        properties: { LinkToB: { relation: [{ id: b2 }] } },
      }),
    });

    expect(await getRelation(a1, setup.relationOnA.id)).toEqual([b2]);
    expect(await getRelation(b1, setup.inverseOnB.id)).toEqual([]);
    expect(await getRelation(b2, setup.inverseOnB.id)).toEqual([a1]);
  });

  it('clearing relation mirrors to empty', async () => {
    const setup = await setupDualRelation();
    const a1 = await newRow(setup.dbA, 'A1');
    const b1 = await newRow(setup.dbB, 'B1');

    await call(`/v1/pages/${a1}`, {
      method: 'PATCH',
      body: JSON.stringify({
        properties: { LinkToB: { relation: [{ id: b1 }] } },
      }),
    });
    await call(`/v1/pages/${a1}`, {
      method: 'PATCH',
      body: JSON.stringify({
        properties: { LinkToB: { relation: [] } },
      }),
    });

    expect(await getRelation(a1, setup.relationOnA.id)).toEqual([]);
    expect(await getRelation(b1, setup.inverseOnB.id)).toEqual([]);
  });

  it('single_property relations do NOT mirror', async () => {
    // Build a different setup: A has a single_property relation, no inverse on B.
    const dbA = await createDatabase(h.handle.db, {
      workspaceId: h.workspaceId,
      parentType: 'page',
      parentId: h.page.id,
      title: [],
      description: [],
      createdBy: h.userId,
      lastEditedBy: h.userId,
    });
    const dbB = await createDatabase(h.handle.db, {
      workspaceId: h.workspaceId,
      parentType: 'page',
      parentId: h.page.id,
      title: [],
      description: [],
      createdBy: h.userId,
      lastEditedBy: h.userId,
    });
    await createProperty(h.handle.db, { databaseId: dbA.id, name: 'Name', type: 'title' });
    await createProperty(h.handle.db, { databaseId: dbB.id, name: 'Name', type: 'title' });
    const rel = await createProperty(h.handle.db, {
      databaseId: dbA.id,
      name: 'PointsToB',
      type: 'relation',
      config: { database_id: dbB.id, type: 'single_property', single_property: {} },
    });

    const a1 = await newRow(dbA.id, 'A1');
    const b1 = await newRow(dbB.id, 'B1');
    await call(`/v1/pages/${a1}`, {
      method: 'PATCH',
      body: JSON.stringify({
        properties: { PointsToB: { relation: [{ id: b1 }] } },
      }),
    });

    // a1's relation is set.
    expect(await getRelation(a1, rel.id)).toEqual([b1]);
    // b1 has no inverse property to mirror into.
  });

  it('sets the relation directly on POST /v1/pages (initial value) and mirrors', async () => {
    const setup = await setupDualRelation();
    const b1 = await newRow(setup.dbB, 'B1');
    // Now create a1 with the relation populated at create-time.
    const res = await call('/v1/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { type: 'database_id', database_id: setup.dbA },
        properties: {
          Name: { title: [{ type: 'text', text: { content: 'A1', link: null } }] },
          LinkToB: { relation: [{ id: b1 }] },
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(await getRelation(body.id, setup.relationOnA.id)).toEqual([b1]);
    expect(await getRelation(b1, setup.inverseOnB.id)).toEqual([body.id]);
  });
});
