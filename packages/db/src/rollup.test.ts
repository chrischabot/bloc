import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type ClientHandle,
  createDatabase,
  createPage,
  createProperty,
  createUser,
  createWorkspace,
  evaluateRollup,
  openDb,
  runMigrations,
  setPageProperty,
} from './index.ts';

let handle: ClientHandle;
let workspaceId: string;
let userId: string;
let dbAId: string;
let dbBId: string;
let relationPropId: string;
let scorePropId: string;
let datePropId: string;
let donePropId: string;
let titlePropAId: string;
let sourcePageId: string;
const targetPages: string[] = [];

beforeAll(async () => {
  handle = await openDb();
  await runMigrations(handle);
  const user = await createUser(handle.db, { email: 'r@local', type: 'person' });
  userId = user.id;
  const ws = await createWorkspace(handle.db, { name: 'R', plan: 'free' });
  workspaceId = ws.id;
  const dbA = await createDatabase(handle.db, {
    workspaceId,
    parentType: 'workspace',
    title: [],
    description: [],
    createdBy: userId,
    lastEditedBy: userId,
  });
  dbAId = dbA.id;
  const dbB = await createDatabase(handle.db, {
    workspaceId,
    parentType: 'workspace',
    title: [],
    description: [],
    createdBy: userId,
    lastEditedBy: userId,
  });
  dbBId = dbB.id;
  // Properties on A
  const titleA = await createProperty(handle.db, {
    databaseId: dbAId,
    name: 'Name',
    type: 'title',
  });
  titlePropAId = titleA.id;
  const rel = await createProperty(handle.db, {
    databaseId: dbAId,
    name: 'Targets',
    type: 'relation',
    config: { database_id: dbBId, type: 'single_property', single_property: {} },
  });
  relationPropId = rel.id;
  // Properties on B
  await createProperty(handle.db, { databaseId: dbBId, name: 'Name', type: 'title' });
  const score = await createProperty(handle.db, {
    databaseId: dbBId,
    name: 'Score',
    type: 'number',
  });
  scorePropId = score.id;
  const dateProp = await createProperty(handle.db, {
    databaseId: dbBId,
    name: 'Due',
    type: 'date',
  });
  datePropId = dateProp.id;
  const done = await createProperty(handle.db, {
    databaseId: dbBId,
    name: 'Done',
    type: 'checkbox',
  });
  donePropId = done.id;
  // Source page in A
  const source = await createPage(handle.db, {
    workspaceId,
    parentType: 'database',
    parentId: dbAId,
    createdBy: userId,
    lastEditedBy: userId,
  });
  sourcePageId = source.id;
  await setPageProperty(handle.db, {
    pageId: source.id,
    propertyId: titlePropAId,
    value: { type: 'title', title: [] },
  });
  // 4 target pages with varying scores/dates/checkboxes
  const fixtures: Array<{ score: number | null; date: string | null; done: boolean }> = [
    { score: 10, date: '2026-05-01', done: true },
    { score: 20, date: '2026-04-15', done: false },
    { score: 30, date: '2026-06-30', done: true },
    { score: null, date: null, done: false }, // empty values
  ];
  for (const f of fixtures) {
    const tp = await createPage(handle.db, {
      workspaceId,
      parentType: 'database',
      parentId: dbBId,
      createdBy: userId,
      lastEditedBy: userId,
    });
    targetPages.push(tp.id);
    await setPageProperty(handle.db, {
      pageId: tp.id,
      propertyId: scorePropId,
      value: { type: 'number', number: f.score },
    });
    if (f.date !== null) {
      await setPageProperty(handle.db, {
        pageId: tp.id,
        propertyId: datePropId,
        value: { type: 'date', date: { start: f.date, end: null, time_zone: null } },
      });
    } else {
      await setPageProperty(handle.db, {
        pageId: tp.id,
        propertyId: datePropId,
        value: { type: 'date', date: null },
      });
    }
    await setPageProperty(handle.db, {
      pageId: tp.id,
      propertyId: donePropId,
      value: { type: 'checkbox', checkbox: f.done },
    });
  }
  // Source page's relation points to all 4 targets.
  await setPageProperty(handle.db, {
    pageId: source.id,
    propertyId: relationPropId,
    value: { type: 'relation', relation: targetPages.map((id) => ({ id })) },
  });
});

afterAll(async () => {
  await handle.close();
});

describe('rollup evaluator', () => {
  it('count returns the number of relation refs', async () => {
    const r = await evaluateRollup(handle.db, {
      sourcePageId,
      relationPropertyId: relationPropId,
      rollupPropertyId: scorePropId,
      function: 'count',
    });
    expect(r).toEqual({ function: 'count', type: 'number', number: 4 });
  });

  it('sum sums numeric target values', async () => {
    const r = await evaluateRollup(handle.db, {
      sourcePageId,
      relationPropertyId: relationPropId,
      rollupPropertyId: scorePropId,
      function: 'sum',
    });
    expect(r).toEqual({ function: 'sum', type: 'number', number: 60 });
  });

  it('average averages numeric target values (excluding nulls)', async () => {
    const r = await evaluateRollup(handle.db, {
      sourcePageId,
      relationPropertyId: relationPropId,
      rollupPropertyId: scorePropId,
      function: 'average',
    });
    expect(r).toEqual({ function: 'average', type: 'number', number: 20 });
  });

  it('min returns the smallest value', async () => {
    const r = await evaluateRollup(handle.db, {
      sourcePageId,
      relationPropertyId: relationPropId,
      rollupPropertyId: scorePropId,
      function: 'min',
    });
    expect(r).toEqual({ function: 'min', type: 'number', number: 10 });
  });

  it('max returns the largest value', async () => {
    const r = await evaluateRollup(handle.db, {
      sourcePageId,
      relationPropertyId: relationPropId,
      rollupPropertyId: scorePropId,
      function: 'max',
    });
    expect(r).toEqual({ function: 'max', type: 'number', number: 30 });
  });

  it('range returns max - min', async () => {
    const r = await evaluateRollup(handle.db, {
      sourcePageId,
      relationPropertyId: relationPropId,
      rollupPropertyId: scorePropId,
      function: 'range',
    });
    expect(r).toEqual({ function: 'range', type: 'number', number: 20 });
  });

  it('median returns the middle value', async () => {
    const r = await evaluateRollup(handle.db, {
      sourcePageId,
      relationPropertyId: relationPropId,
      rollupPropertyId: scorePropId,
      function: 'median',
    });
    expect(r).toEqual({ function: 'median', type: 'number', number: 20 });
  });

  it('count_values counts non-empty values', async () => {
    const r = await evaluateRollup(handle.db, {
      sourcePageId,
      relationPropertyId: relationPropId,
      rollupPropertyId: scorePropId,
      function: 'count_values',
    });
    expect(r).toEqual({ function: 'count_values', type: 'number', number: 3 });
  });

  it('percent_not_empty returns the fraction of non-empty values', async () => {
    const r = await evaluateRollup(handle.db, {
      sourcePageId,
      relationPropertyId: relationPropId,
      rollupPropertyId: scorePropId,
      function: 'percent_not_empty',
    });
    expect(r).toEqual({ function: 'percent_not_empty', type: 'number', number: 0.75 });
  });

  it('earliest_date returns the smallest date as ISO', async () => {
    const r = await evaluateRollup(handle.db, {
      sourcePageId,
      relationPropertyId: relationPropId,
      rollupPropertyId: datePropId,
      function: 'earliest_date',
    });
    if (r.type !== 'date') throw new Error('expected date');
    expect(r.date?.start).toMatch(/^2026-04-15/);
  });

  it('latest_date returns the largest date as ISO', async () => {
    const r = await evaluateRollup(handle.db, {
      sourcePageId,
      relationPropertyId: relationPropId,
      rollupPropertyId: datePropId,
      function: 'latest_date',
    });
    if (r.type !== 'date') throw new Error('expected date');
    expect(r.date?.start).toMatch(/^2026-06-30/);
  });

  it('date_range returns start + end', async () => {
    const r = await evaluateRollup(handle.db, {
      sourcePageId,
      relationPropertyId: relationPropId,
      rollupPropertyId: datePropId,
      function: 'date_range',
    });
    if (r.type !== 'date') throw new Error('expected date');
    expect(r.date?.start).toMatch(/^2026-04-15/);
    expect(r.date?.end).toMatch(/^2026-06-30/);
  });

  it('show_original returns the array of target values', async () => {
    const r = await evaluateRollup(handle.db, {
      sourcePageId,
      relationPropertyId: relationPropId,
      rollupPropertyId: scorePropId,
      function: 'show_original',
    });
    if (r.type !== 'array') throw new Error('expected array');
    expect(r.array).toHaveLength(4);
  });

  it('checked counts true checkbox values', async () => {
    const r = await evaluateRollup(handle.db, {
      sourcePageId,
      relationPropertyId: relationPropId,
      rollupPropertyId: donePropId,
      function: 'checked',
    });
    expect(r).toEqual({ function: 'checked', type: 'number', number: 2 });
  });

  it('percent_checked returns the fraction true', async () => {
    const r = await evaluateRollup(handle.db, {
      sourcePageId,
      relationPropertyId: relationPropId,
      rollupPropertyId: donePropId,
      function: 'percent_checked',
    });
    expect(r).toEqual({ function: 'percent_checked', type: 'number', number: 0.5 });
  });

  it('unsupported function returns unsupported envelope', async () => {
    const r = await evaluateRollup(handle.db, {
      sourcePageId,
      relationPropertyId: relationPropId,
      rollupPropertyId: scorePropId,
      function: 'super_advanced',
    });
    expect(r).toEqual({ function: 'super_advanced', type: 'unsupported', unsupported: {} });
  });

  it('empty relation returns count=0 / sum=0', async () => {
    const empty = await createPage(handle.db, {
      workspaceId,
      parentType: 'database',
      parentId: dbAId,
      createdBy: userId,
      lastEditedBy: userId,
    });
    const r = await evaluateRollup(handle.db, {
      sourcePageId: empty.id,
      relationPropertyId: relationPropId,
      rollupPropertyId: scorePropId,
      function: 'sum',
    });
    expect(r).toEqual({ function: 'sum', type: 'number', number: 0 });
  });
});
