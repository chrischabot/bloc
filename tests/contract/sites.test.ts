import { type TestHarness, bootTestHarness } from '@bloc/api/test-helpers';
import { upsertPublication } from '@bloc/db';
import { LATEST_VERSION } from '@bloc/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let h: TestHarness;

beforeEach(async () => {
  h = await bootTestHarness();
});
afterEach(async () => {
  await h.handle.close();
});

const BASE = 'http://test.local';

describe('public sites endpoint', () => {
  it('returns the publication when live', async () => {
    const slug = `welcome-${Date.now()}`;
    await upsertPublication(h.handle.db, {
      pageId: h.page.id,
      slug,
      state: 'live',
      createdBy: h.userId,
    });
    const res = await h.app.request(`${BASE}/v1/sites/${encodeURIComponent(slug)}`, {
      headers: { 'notion-version': LATEST_VERSION },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      object: string;
      slug: string;
      page_id: string;
      show_toc: boolean;
    };
    expect(body.object).toBe('publication');
    expect(body.slug).toBe(slug);
    expect(body.page_id).toBe(h.page.id);
    expect(typeof body.show_toc).toBe('boolean');
  });

  it('works without an Authorization header', async () => {
    const slug = `nopub-${Date.now()}`;
    await upsertPublication(h.handle.db, {
      pageId: h.page.id,
      slug,
      state: 'live',
      createdBy: h.userId,
    });
    const res = await h.app.request(`${BASE}/v1/sites/${encodeURIComponent(slug)}`);
    expect(res.status).toBe(200);
  });

  it('404 when slug does not exist', async () => {
    const res = await h.app.request(`${BASE}/v1/sites/does-not-exist`);
    expect(res.status).toBe(404);
  });

  it('404 when publication is expired', async () => {
    const slug = `exp-${Date.now()}`;
    await upsertPublication(h.handle.db, {
      pageId: h.page.id,
      slug,
      state: 'live',
      expiresAt: new Date(Date.now() - 1000),
      createdBy: h.userId,
    });
    const res = await h.app.request(`${BASE}/v1/sites/${encodeURIComponent(slug)}`);
    expect(res.status).toBe(404);
  });

  it('404 when publication is in draft state', async () => {
    const slug = `draft-${Date.now()}`;
    await upsertPublication(h.handle.db, {
      pageId: h.page.id,
      slug,
      state: 'draft',
      createdBy: h.userId,
    });
    const res = await h.app.request(`${BASE}/v1/sites/${encodeURIComponent(slug)}`);
    expect(res.status).toBe(404);
  });

  it('error envelope is canonical', async () => {
    const res = await h.app.request(`${BASE}/v1/sites/missing-slug`);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['object']).toBe('error');
    expect(body['code']).toBe('object_not_found');
    expect(typeof body['request_id']).toBe('string');
  });
});
