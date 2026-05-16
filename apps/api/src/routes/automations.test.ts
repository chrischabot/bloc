import { appendChildren, upsertButton } from '@bloc/db';
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

async function createTestDb(): Promise<{ id: string; titleId: string }> {
  const res = await call('/v1/databases', {
    method: 'POST',
    body: JSON.stringify({
      parent: { type: 'page_id', page_id: h.page.id },
      title: [{ type: 'text', text: { content: 'Tasks', link: null } }],
      properties: { Name: { type: 'title', title: {} } },
    }),
  });
  const body = (await res.json()) as {
    id: string;
    properties: Record<string, { id: string; type: string }>;
  };
  return { id: body.id, titleId: body.properties['Name']!.id };
}

describe('buttons', () => {
  it('invokes a button stored on a block', async () => {
    const db = await createTestDb();
    // Insert a button block in the seed page.
    const append = await appendChildren(h.handle.db, {
      workspaceId: h.workspaceId,
      parentType: 'page',
      parentId: h.page.id,
      actor: h.userId,
      children: [
        {
          type: 'button',
          content: {
            button: {
              label: 'Add task',
              steps: [
                {
                  type: 'add_page_to_database',
                  database_id: db.id,
                  properties: {
                    Name: { title: [{ type: 'text', text: { content: 'Generated', link: null } }] },
                  },
                },
              ],
            },
          },
        },
      ],
    });
    const blockId = append[0]!.id;
    await upsertButton(h.handle.db, {
      blockId,
      steps: [
        {
          type: 'add_page_to_database',
          database_id: db.id,
          properties: {
            Name: { title: [{ type: 'text', text: { content: 'Generated', link: null } }] },
          },
        },
      ],
      createdBy: h.userId,
    });

    const res = await call(`/v1/buttons/${blockId}/invoke`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      object: string;
      status: string;
      steps: { type: string; status: string }[];
    };
    expect(body.object).toBe('automation_run');
    expect(body.status).toBe('success');
    expect(body.steps).toHaveLength(1);
    expect(body.steps[0]!.type).toBe('add_page_to_database');
    expect(body.steps[0]!.status).toBe('success');

    // Verify the database now has a row.
    const query = await call(`/v1/databases/${db.id}/query`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const queryBody = (await query.json()) as { results: unknown[] };
    expect(queryBody.results).toHaveLength(1);
  });

  it('rejects unknown button id', async () => {
    const res = await call('/v1/buttons/00000000-0000-0000-0000-000000000000/invoke', {
      method: 'POST',
    });
    expect(res.status).toBe(404);
  });
});

describe('automations CRUD', () => {
  it('creates / lists / updates / deletes', async () => {
    const db = await createTestDb();
    const create = await call(`/v1/databases/${db.id}/automations`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Notify on add',
        trigger: { kind: 'page_added' },
        steps: [
          {
            type: 'send_notification',
            recipients: ['{{actor.id}}'],
            body: 'A new row was added',
          },
        ],
      }),
    });
    expect(create.status).toBe(200);
    const created = (await create.json()) as { id: string; name: string; enabled: boolean };
    expect(created.enabled).toBe(true);

    const list = await call(`/v1/databases/${db.id}/automations`);
    const listBody = (await list.json()) as { results: { id: string }[] };
    expect(listBody.results.some((r) => r.id === created.id)).toBe(true);

    const patch = await call(`/v1/automations/${created.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: false }),
    });
    const patchBody = (await patch.json()) as { enabled: boolean };
    expect(patchBody.enabled).toBe(false);

    const del = await call(`/v1/automations/${created.id}`, { method: 'DELETE' });
    expect(del.status).toBe(204);
  });

  it('runs:test dry-runs steps and records a run', async () => {
    const db = await createTestDb();
    const create = await call(`/v1/databases/${db.id}/automations`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Add task',
        trigger: { kind: 'page_added' },
        steps: [
          {
            type: 'add_page_to_database',
            database_id: db.id,
            properties: {
              Name: { title: [{ type: 'text', text: { content: 'from-test', link: null } }] },
            },
          },
        ],
      }),
    });
    const { id: autoId } = (await create.json()) as { id: string };

    const test = await call(`/v1/automations/${autoId}/runs:test`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(test.status).toBe(200);
    const body = (await test.json()) as { status: string; steps: { status: string }[] };
    expect(body.status).toBe('success');

    const runs = await call(`/v1/automations/${autoId}/runs`);
    const runsBody = (await runs.json()) as { results: unknown[] };
    expect(runsBody.results.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects steps array > 50', async () => {
    const db = await createTestDb();
    const res = await call(`/v1/databases/${db.id}/automations`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'too many',
        trigger: { kind: 'page_added' },
        steps: Array.from({ length: 51 }, () => ({
          type: 'open_page',
          page_id: h.page.id,
        })),
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects unknown step type', async () => {
    const db = await createTestDb();
    const res = await call(`/v1/databases/${db.id}/automations`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'bad',
        trigger: { kind: 'page_added' },
        steps: [{ type: 'not_a_step' }],
      }),
    });
    expect(res.status).toBe(400);
  });
});

describe('automations chaos — templating', () => {
  it('rejects __proto__ in templates safely (renders empty)', async () => {
    const db = await createTestDb();
    const create = await call(`/v1/databases/${db.id}/automations`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'proto',
        trigger: { kind: 'page_added' },
        steps: [
          {
            type: 'send_notification',
            recipients: ['{{actor.id}}'],
            body: 'attack {{__proto__.polluted}}',
          },
        ],
      }),
    });
    const { id: autoId } = (await create.json()) as { id: string };
    const test = await call(`/v1/automations/${autoId}/runs:test`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(test.status).toBe(200);
  });
});
