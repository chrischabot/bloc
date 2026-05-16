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

describe('publications', () => {
  it('publish + retrieve + unpublish round-trip', async () => {
    const pub = await call(`/v1/pages/${h.page.id}/publication`, {
      method: 'POST',
      body: JSON.stringify({ allow_comment: true, allow_duplicate: false }),
    });
    expect(pub.status).toBe(200);
    const body = (await pub.json()) as {
      object: string;
      page_id: string;
      slug: string;
      state: string;
    };
    expect(body.object).toBe('publication');
    expect(body.page_id).toBe(h.page.id);
    expect(body.slug).toBeTruthy();
    expect(body.state).toBe('live');

    const get = await call(`/v1/pages/${h.page.id}/publication`);
    expect(get.status).toBe(200);

    const del = await call(`/v1/pages/${h.page.id}/publication`, { method: 'DELETE' });
    expect(del.status).toBe(204);

    const after = await call(`/v1/pages/${h.page.id}/publication`);
    expect(after.status).toBe(404);
  });

  it('republish replaces config in place', async () => {
    await call(`/v1/pages/${h.page.id}/publication`, {
      method: 'POST',
      body: JSON.stringify({ allow_comment: true }),
    });
    const repub = await call(`/v1/pages/${h.page.id}/publication`, {
      method: 'POST',
      body: JSON.stringify({ allow_comment: false }),
    });
    expect(repub.status).toBe(200);
    const body = (await repub.json()) as { allow_comment: boolean };
    expect(body.allow_comment).toBe(false);
  });
});

describe('custom domains', () => {
  it('owner creates + retrieves + updates status + deletes', async () => {
    const create = await call(`/v1/workspaces/${h.workspaceId}/custom_domains`, {
      method: 'POST',
      body: JSON.stringify({ domain: 'docs.example.com' }),
    });
    expect(create.status).toBe(200);
    const body = (await create.json()) as {
      id: string;
      domain: string;
      status: string;
      dns_records: unknown[];
    };
    expect(body.domain).toBe('docs.example.com');
    expect(body.status).toBe('pending');
    expect(body.dns_records.length).toBeGreaterThan(0);

    const list = await call(`/v1/workspaces/${h.workspaceId}/custom_domains`);
    const listBody = (await list.json()) as { results: { domain: string }[] };
    expect(listBody.results.some((r) => r.domain === 'docs.example.com')).toBe(true);

    const patch = await call(`/v1/workspaces/${h.workspaceId}/custom_domains/${body.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'live' }),
    });
    expect(patch.status).toBe(200);
    const patchBody = (await patch.json()) as { status: string };
    expect(patchBody.status).toBe('live');

    const del = await call(`/v1/workspaces/${h.workspaceId}/custom_domains/${body.id}`, {
      method: 'DELETE',
    });
    expect(del.status).toBe(204);
  });

  it('rejects reserved domain', async () => {
    const res = await call(`/v1/workspaces/${h.workspaceId}/custom_domains`, {
      method: 'POST',
      body: JSON.stringify({ domain: 'foo.notion.so' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects malformed domain', async () => {
    const res = await call(`/v1/workspaces/${h.workspaceId}/custom_domains`, {
      method: 'POST',
      body: JSON.stringify({ domain: 'not_a_domain' }),
    });
    expect(res.status).toBe(400);
  });

  it('409 on duplicate domain', async () => {
    await call(`/v1/workspaces/${h.workspaceId}/custom_domains`, {
      method: 'POST',
      body: JSON.stringify({ domain: 'dup.example.com' }),
    });
    const res = await call(`/v1/workspaces/${h.workspaceId}/custom_domains`, {
      method: 'POST',
      body: JSON.stringify({ domain: 'dup.example.com' }),
    });
    expect(res.status).toBe(409);
  });
});
