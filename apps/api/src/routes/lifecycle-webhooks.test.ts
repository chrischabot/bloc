import { LATEST_VERSION } from '@bloc/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type TestHarness, bootTestHarness, closeHarness } from '../test-helpers.ts';

interface RecordedDelivery {
  body: { type: string; data?: Record<string, unknown> };
}

let h: TestHarness;
let deliveries: RecordedDelivery[] = [];

const recordFetch: typeof fetch = async (input, init) => {
  void input;
  const body = typeof init?.body === 'string' ? init.body : '';
  let parsed: { type: string; data?: Record<string, unknown> } = { type: 'unknown' };
  try {
    parsed = JSON.parse(body) as typeof parsed;
  } catch {
    // ignore
  }
  deliveries.push({ body: parsed });
  if (parsed.type === 'verification') {
    return new Response(JSON.stringify({ token: (parsed as { token?: string }).token }), {
      status: 200,
    });
  }
  return new Response('', { status: 200 });
};

beforeEach(async () => {
  deliveries = [];
  h = await bootTestHarness({ webhookFetch: recordFetch });
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

async function registerWebhook(events: string[]): Promise<void> {
  const res = await call('/v1/webhooks', {
    method: 'POST',
    body: JSON.stringify({
      endpoint_url: 'https://receiver.example.com/hook',
      subscribed_events: events,
    }),
  });
  expect(res.status).toBe(200);
  // Drop verification deliveries so subsequent assertions only count business events.
  deliveries = deliveries.filter((d) => d.body.type !== 'verification');
}

async function waitForEvent(type: string, timeoutMs = 200): Promise<RecordedDelivery | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const hit = deliveries.find((d) => d.body.type === type);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 10));
  }
  return null;
}

async function createDb(): Promise<{ id: string; titleId: string }> {
  const res = await call('/v1/databases', {
    method: 'POST',
    body: JSON.stringify({
      parent: { type: 'page_id', page_id: h.page.id },
      properties: { Name: { type: 'title', title: {} } },
    }),
  });
  const body = (await res.json()) as {
    id: string;
    properties: Record<string, { id: string }>;
  };
  return { id: body.id, titleId: body.properties['Name']!.id };
}

describe('lifecycle webhook events', () => {
  it('emits comment.created on POST /v1/comments', async () => {
    await registerWebhook(['comment.created']);
    const res = await call('/v1/comments', {
      method: 'POST',
      body: JSON.stringify({
        parent: { page_id: h.page.id },
        rich_text: [{ type: 'text', text: { content: 'hi', link: null } }],
      }),
    });
    expect(res.status).toBe(200);
    expect(await waitForEvent('comment.created')).not.toBeNull();
  });

  it('emits comment.resolved on POST /v1/comments/:id/resolve', async () => {
    await registerWebhook(['comment.created', 'comment.resolved']);
    const create = await call('/v1/comments', {
      method: 'POST',
      body: JSON.stringify({
        parent: { page_id: h.page.id },
        rich_text: [{ type: 'text', text: { content: 'resolve me', link: null } }],
      }),
    });
    const { id } = (await create.json()) as { id: string };
    await waitForEvent('comment.created');
    deliveries = deliveries.filter((d) => d.body.type !== 'comment.created');

    const resolve = await call(`/v1/comments/${id}/resolve`, { method: 'POST' });
    expect(resolve.status).toBe(200);
    expect(await waitForEvent('comment.resolved')).not.toBeNull();
  });

  it('emits database.created on POST /v1/databases', async () => {
    await registerWebhook(['database.created']);
    await createDb();
    expect(await waitForEvent('database.created')).not.toBeNull();
  });

  it('emits database.updated on PATCH /v1/databases/:id', async () => {
    await registerWebhook(['database.created', 'database.updated']);
    const db = await createDb();
    await waitForEvent('database.created');
    deliveries = deliveries.filter((d) => d.body.type !== 'database.created');

    const patch = await call(`/v1/databases/${db.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        properties: { Priority: { type: 'select', select: { options: [] } } },
      }),
    });
    expect(patch.status).toBe(200);
    expect(await waitForEvent('database.updated')).not.toBeNull();
  });

  it('emits automation.run.completed on dry-run', async () => {
    await registerWebhook(['automation.run.completed']);
    const db = await createDb();
    const create = await call(`/v1/databases/${db.id}/automations`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'webhook test',
        trigger: { kind: 'page_added' },
        steps: [
          {
            type: 'add_page_to_database',
            database_id: db.id,
            properties: {
              Name: { title: [{ type: 'text', text: { content: 'r', link: null } }] },
            },
          },
        ],
      }),
    });
    const { id: autoId } = (await create.json()) as { id: string };
    const dry = await call(`/v1/automations/${autoId}/runs:test`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(dry.status).toBe(200);
    expect(await waitForEvent('automation.run.completed')).not.toBeNull();
  });

  it('emits form.submission.created on public submission', async () => {
    await registerWebhook(['form.submission.created']);
    const db = await createDb();
    const form = await call('/v1/forms', {
      method: 'POST',
      body: JSON.stringify({
        database_id: db.id,
        name: 'Feedback',
        config: { kind: 'form', title: 'Feedback', policy: 'public' },
      }),
    });
    const { id: formId } = (await form.json()) as { id: string };
    const submit = await h.app.request(`${BASE}/v1/forms/${formId}/submissions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'notion-version': LATEST_VERSION,
      },
      body: JSON.stringify({
        values: {
          Name: { title: [{ type: 'text', text: { content: 'A', link: null } }] },
        },
      }),
    });
    expect(submit.status).toBe(200);
    expect(await waitForEvent('form.submission.created')).not.toBeNull();
  });

  it('emits publication.created on POST and publication.deleted on DELETE', async () => {
    await registerWebhook(['publication.created', 'publication.deleted']);
    const pub = await call(`/v1/pages/${h.page.id}/publication`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(pub.status).toBe(200);
    expect(await waitForEvent('publication.created')).not.toBeNull();
    deliveries = deliveries.filter((d) => d.body.type !== 'publication.created');

    const del = await call(`/v1/pages/${h.page.id}/publication`, { method: 'DELETE' });
    expect(del.status).toBe(204);
    expect(await waitForEvent('publication.deleted')).not.toBeNull();
  });

  it('emits wiki.verification.changed on verify and unverify', async () => {
    await registerWebhook(['wiki.verification.changed']);
    const on = await call(`/v1/pages/${h.page.id}/wiki`, { method: 'POST' });
    expect(on.status).toBe(200);

    const verify = await call(`/v1/pages/${h.page.id}/verify`, {
      method: 'POST',
      body: JSON.stringify({ expires_in_days: 30 }),
    });
    expect(verify.status).toBe(200);
    expect(await waitForEvent('wiki.verification.changed')).not.toBeNull();
    deliveries = deliveries.filter((d) => d.body.type !== 'wiki.verification.changed');

    const unverify = await call(`/v1/pages/${h.page.id}/unverify`, { method: 'POST' });
    expect(unverify.status).toBe(200);
    expect(await waitForEvent('wiki.verification.changed')).not.toBeNull();
  });
});
