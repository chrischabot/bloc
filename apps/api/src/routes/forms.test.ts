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

async function call(
  path: string,
  init: RequestInit & { bearer?: string | null } = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.bearer !== null) {
    headers.set('authorization', init.bearer ?? h.bearer);
  }
  headers.set('notion-version', LATEST_VERSION);
  if (init.body !== undefined) headers.set('content-type', 'application/json');
  const out: RequestInit = { headers };
  if (init.method !== undefined) out.method = init.method;
  if (init.body !== undefined) out.body = init.body;
  return h.app.request(BASE + path, out);
}

async function createDb(): Promise<{ id: string }> {
  const res = await call('/v1/databases', {
    method: 'POST',
    body: JSON.stringify({
      parent: { type: 'page_id', page_id: h.page.id },
      properties: {
        Name: { type: 'title', title: {} },
        Email: { type: 'email', email: {} },
      },
    }),
  });
  return (await res.json()) as { id: string };
}

async function createFormView(
  databaseId: string,
  overrides?: Partial<{ policy: string; close_at: string | null; max_submissions: number | null }>,
): Promise<{ id: string }> {
  const res = await call('/v1/forms', {
    method: 'POST',
    body: JSON.stringify({
      database_id: databaseId,
      name: 'Submit',
      config: {
        kind: 'form',
        title: 'Feedback',
        policy: overrides?.policy ?? 'public',
        ...(overrides?.close_at !== undefined ? { close_at: overrides.close_at } : {}),
        ...(overrides?.max_submissions !== undefined
          ? { max_submissions: overrides.max_submissions }
          : {}),
      },
    }),
  });
  expect(res.status).toBe(200);
  return (await res.json()) as { id: string };
}

describe('forms API', () => {
  it('creates a form view', async () => {
    const db = await createDb();
    const form = await createFormView(db.id);
    expect(form.id).toBeTruthy();
  });

  it('public submission lands a row in the target database', async () => {
    const db = await createDb();
    const form = await createFormView(db.id, { policy: 'public' });
    const res = await call(`/v1/forms/${form.id}/submissions`, {
      method: 'POST',
      bearer: null,
      body: JSON.stringify({
        values: {
          Name: { title: [{ type: 'text', text: { content: 'Alex', link: null } }] },
          Email: { email: 'alex@example.com' },
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { object: string; row_id: string };
    expect(body.object).toBe('form_submission');
    expect(body.row_id).toBeTruthy();

    // Verify the row exists in the database.
    const q = await call(`/v1/databases/${db.id}/query`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const qb = (await q.json()) as { results: unknown[] };
    expect(qb.results).toHaveLength(1);
  });

  it('rejects submission without title', async () => {
    const db = await createDb();
    const form = await createFormView(db.id, { policy: 'public' });
    const res = await call(`/v1/forms/${form.id}/submissions`, {
      method: 'POST',
      bearer: null,
      body: JSON.stringify({ values: { Email: { email: 'a@b.c' } } }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects unknown property name', async () => {
    const db = await createDb();
    const form = await createFormView(db.id, { policy: 'public' });
    const res = await call(`/v1/forms/${form.id}/submissions`, {
      method: 'POST',
      bearer: null,
      body: JSON.stringify({
        values: {
          Name: { title: [{ type: 'text', text: { content: 'A', link: null } }] },
          Mystery: { rich_text: [] },
        },
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects unauthenticated submission on workspace-policy form', async () => {
    const db = await createDb();
    const form = await createFormView(db.id, { policy: 'workspace' });
    const res = await call(`/v1/forms/${form.id}/submissions`, {
      method: 'POST',
      bearer: null,
      body: JSON.stringify({
        values: { Name: { title: [{ type: 'text', text: { content: 'A', link: null } }] } },
      }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 410 when close_at has passed', async () => {
    const db = await createDb();
    const form = await createFormView(db.id, {
      policy: 'public',
      close_at: new Date(Date.now() - 1000).toISOString(),
    });
    const res = await call(`/v1/forms/${form.id}/submissions`, {
      method: 'POST',
      bearer: null,
      body: JSON.stringify({
        values: { Name: { title: [{ type: 'text', text: { content: 'A', link: null } }] } },
      }),
    });
    expect(res.status).toBe(410);
  });

  it('lists submissions for the form (workspace scope)', async () => {
    const db = await createDb();
    const form = await createFormView(db.id, { policy: 'public' });
    for (let i = 0; i < 3; i++) {
      await call(`/v1/forms/${form.id}/submissions`, {
        method: 'POST',
        bearer: null,
        body: JSON.stringify({
          values: { Name: { title: [{ type: 'text', text: { content: `r${i}`, link: null } }] } },
        }),
      });
    }
    const list = await call(`/v1/forms/${form.id}/submissions`);
    expect(list.status).toBe(200);
    const body = (await list.json()) as { results: unknown[] };
    expect(body.results).toHaveLength(3);
  });

  it('retrieve form view returns config', async () => {
    const db = await createDb();
    const form = await createFormView(db.id);
    const res = await call(`/v1/forms/${form.id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { object: string; config: { policy: string } };
    expect(body.object).toBe('form_view');
    expect(body.config.policy).toBe('public');
  });
});
