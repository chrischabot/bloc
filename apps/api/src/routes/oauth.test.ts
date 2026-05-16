import { LATEST_VERSION } from '@bloc/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type TestHarness, bootTestHarness, closeHarness } from '../test-helpers.ts';
import { resetOAuthStates } from './oauth.ts';

let h: TestHarness;

beforeEach(async () => {
  resetOAuthStates();
  process.env['AUTH_DELIVERY'] = 'test';
  h = await bootTestHarness();
});
afterEach(async () => {
  await closeHarness(h);
});

const BASE = 'http://test.local';

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('notion-version', LATEST_VERSION);
  if (init.body !== undefined) headers.set('content-type', 'application/json');
  return h.app.request(BASE + path, { ...init, headers });
}

describe('OAuth Google', () => {
  it('start returns a Google authorization URL with PKCE challenge + state', async () => {
    const res = await call('/v1/auth/google/start', { method: 'POST', body: '{}' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      object: string;
      authorization_url: string;
      state: string;
    };
    expect(body.object).toBe('oauth_start');
    expect(body.authorization_url).toMatch(
      /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/,
    );
    expect(body.state).toMatch(/.{20,}/);
    const url = new URL(body.authorization_url);
    expect(url.searchParams.get('code_challenge')).toMatch(/.+/);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('state')).toBe(body.state);
  });

  it('callback in test-mode signs up a new user + workspace and returns a session bearer', async () => {
    const start = await call('/v1/auth/google/start', { method: 'POST', body: '{}' });
    const { state } = (await start.json()) as { state: string };
    const cb = await call('/v1/auth/google/callback', {
      method: 'POST',
      body: JSON.stringify({
        code: 'stub-code',
        state,
        email: 'new@example.com',
        name: 'New User',
      }),
    });
    expect(cb.status).toBe(200);
    const body = (await cb.json()) as {
      object: string;
      user_id: string;
      workspace_id: string;
      session_bearer: string;
    };
    expect(body.object).toBe('auth_session');
    expect(body.user_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.workspace_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.session_bearer).toMatch(/^Bearer test_/);

    // The session bearer authenticates a follow-up request.
    const me = await h.app.request(`${BASE}/v1/users/me`, {
      headers: { authorization: body.session_bearer, 'notion-version': LATEST_VERSION },
    });
    expect(me.status).toBe(200);
  });

  it('callback for an existing user routes to their workspace', async () => {
    const start1 = await call('/v1/auth/google/start', { method: 'POST', body: '{}' });
    const { state: state1 } = (await start1.json()) as { state: string };
    const first = await call('/v1/auth/google/callback', {
      method: 'POST',
      body: JSON.stringify({ code: 'c1', state: state1, email: 'shared@example.com' }),
    });
    const firstBody = (await first.json()) as { user_id: string; workspace_id: string };
    expect(first.status).toBe(200);

    const start2 = await call('/v1/auth/google/start', { method: 'POST', body: '{}' });
    const { state: state2 } = (await start2.json()) as { state: string };
    const second = await call('/v1/auth/google/callback', {
      method: 'POST',
      body: JSON.stringify({ code: 'c2', state: state2, email: 'shared@example.com' }),
    });
    const secondBody = (await second.json()) as { user_id: string; workspace_id: string };
    expect(secondBody.user_id).toBe(firstBody.user_id);
    expect(secondBody.workspace_id).toBe(firstBody.workspace_id);
  });

  it('rejects callback with invalid state', async () => {
    const res = await call('/v1/auth/google/callback', {
      method: 'POST',
      body: JSON.stringify({ code: 'x', state: 'unknown', email: 'a@example.com' }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects test-mode callback without email', async () => {
    const start = await call('/v1/auth/google/start', { method: 'POST', body: '{}' });
    const { state } = (await start.json()) as { state: string };
    const res = await call('/v1/auth/google/callback', {
      method: 'POST',
      body: JSON.stringify({ code: 'x', state }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects callback when AUTH_DELIVERY is not test', async () => {
    process.env['AUTH_DELIVERY'] = 'live';
    const start = await call('/v1/auth/google/start', { method: 'POST', body: '{}' });
    const { state } = (await start.json()) as { state: string };
    const res = await call('/v1/auth/google/callback', {
      method: 'POST',
      body: JSON.stringify({ code: 'x', state, email: 'a@example.com' }),
    });
    expect(res.status).toBe(400);
    process.env['AUTH_DELIVERY'] = 'test';
  });

  it('GET callback (browser redirect flow) works', async () => {
    const start = await call('/v1/auth/google/start', { method: 'POST', body: '{}' });
    const { state } = (await start.json()) as { state: string };
    const params = new URLSearchParams({
      code: 'stub-code',
      state,
      email: 'redirect@example.com',
      name: 'Redirect User',
    });
    const cb = await call(`/v1/auth/google/callback?${params.toString()}`);
    expect(cb.status).toBe(200);
    const body = (await cb.json()) as { object: string; session_bearer: string };
    expect(body.object).toBe('auth_session');
    expect(body.session_bearer).toMatch(/^Bearer test_/);
  });
});
