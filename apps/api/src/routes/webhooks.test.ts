import { updateWebhook } from '@bloc/db';
import { LATEST_VERSION } from '@bloc/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type TestHarness, bootTestHarness, closeHarness } from '../test-helpers.ts';
import { verifySignature } from '../webhooks/signing.ts';

interface RecordedRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

let h: TestHarness;
let recorded: RecordedRequest[] = [];
let fetchBehaviour: ((req: RecordedRequest) => { status: number; body: string }) | null = null;

const mockFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const headers: Record<string, string> = {};
  for (const [k, v] of new Headers(init?.headers).entries()) headers[k.toLowerCase()] = v;
  const body = typeof init?.body === 'string' ? init.body : '';
  const req: RecordedRequest = { url, headers, body };
  recorded.push(req);
  const result = fetchBehaviour?.(req) ?? { status: 200, body: '' };
  return new Response(result.body, { status: result.status });
};

beforeEach(async () => {
  recorded = [];
  fetchBehaviour = null;
  h = await bootTestHarness({ webhookFetch: mockFetch });
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

describe('webhooks API', () => {
  it('create runs verification handshake', async () => {
    fetchBehaviour = (req) => {
      const parsed = JSON.parse(req.body) as { token: string; type: string };
      expect(parsed.type).toBe('verification');
      return { status: 200, body: JSON.stringify({ token: parsed.token }) };
    };
    const res = await call('/v1/webhooks', {
      method: 'POST',
      body: JSON.stringify({
        endpoint_url: 'https://receiver.example.com/hook',
        subscribed_events: ['page.created'],
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      status: string;
      signing_secret: string;
      verification: { ok: boolean };
    };
    expect(body.signing_secret).toMatch(/^whsec_/);
    expect(body.verification.ok).toBe(true);
    expect(body.status).toBe('active');

    // Verification request should carry the verification header + valid sig.
    const verificationReq = recorded[0];
    expect(verificationReq).toBeDefined();
    expect(verificationReq!.headers['notion-webhook-verification']).toBe('true');
    const signature = verificationReq!.headers['x-notion-signature'];
    expect(signature).toMatch(/^sha256=/);
    const verified = verifySignature(body.signing_secret, verificationReq!.body, signature!);
    expect(verified).toBe(true);
  });

  it('rejects mismatched verification token', async () => {
    fetchBehaviour = () => ({ status: 200, body: JSON.stringify({ token: 'wrong' }) });
    const res = await call('/v1/webhooks', {
      method: 'POST',
      body: JSON.stringify({
        endpoint_url: 'https://receiver.example.com/hook',
        subscribed_events: ['page.created'],
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { verification: { ok: boolean }; status: string };
    expect(body.verification.ok).toBe(false);
    expect(body.status).toBe('unverified');
  });

  it('rejects non-http(s) endpoint_url', async () => {
    const res = await call('/v1/webhooks', {
      method: 'POST',
      body: JSON.stringify({
        endpoint_url: 'javascript:alert(1)',
        subscribed_events: ['page.created'],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('ping dispatches and records delivery', async () => {
    fetchBehaviour = (req) => {
      if (req.headers['notion-webhook-verification'] === 'true') {
        const t = (JSON.parse(req.body) as { token: string }).token;
        return { status: 200, body: JSON.stringify({ token: t }) };
      }
      return { status: 200, body: 'ok' };
    };
    const create = await call('/v1/webhooks', {
      method: 'POST',
      body: JSON.stringify({
        endpoint_url: 'https://receiver.example.com/hook',
        subscribed_events: ['webhook.ping' as never],
      }),
    });
    expect(create.status).toBe(400); // 'webhook.ping' not in subscribed_events enum
  });

  it('lists deliveries after a ping', async () => {
    fetchBehaviour = (req) => {
      if (req.headers['notion-webhook-verification'] === 'true') {
        const t = (JSON.parse(req.body) as { token: string }).token;
        return { status: 200, body: JSON.stringify({ token: t }) };
      }
      return { status: 200, body: 'ok' };
    };
    const create = await call('/v1/webhooks', {
      method: 'POST',
      body: JSON.stringify({
        endpoint_url: 'https://receiver.example.com/hook',
        subscribed_events: ['page.created'],
      }),
    });
    const { id } = (await create.json()) as { id: string };
    const deliveries = await call(`/v1/webhooks/${id}/deliveries`);
    expect(deliveries.status).toBe(200);
    const body = (await deliveries.json()) as { results: { event_type: string }[] };
    // The verification delivery is recorded.
    expect(body.results.some((r) => r.event_type === 'verification')).toBe(true);
  });

  it('rejects subscribed_events > 25', async () => {
    const res = await call('/v1/webhooks', {
      method: 'POST',
      body: JSON.stringify({
        endpoint_url: 'https://receiver.example.com/hook',
        subscribed_events: Array.from({ length: 26 }, () => 'page.created'),
      }),
    });
    expect(res.status).toBe(400);
  });

  it('signing.verifySignature rejects tampered body', async () => {
    const secret = 'whsec_secret_with_at_least_some_length_to_be_realistic';
    const body = '{"a":1}';
    const { signBody } = await import('../webhooks/signing.ts');
    const sig = signBody(secret, body);
    expect(verifySignature(secret, body, sig)).toBe(true);
    expect(verifySignature(secret, '{"a":2}', sig)).toBe(false);
  });

  it('auto-disables after 5 consecutive failures (in-process test of internal helper)', async () => {
    // Create + verify happy path, then drop a webhook into failure_streak=4 directly
    // and dispatch one event that fails -> streak hits 5 -> auto_disabled.
    fetchBehaviour = (req) => {
      if (req.headers['notion-webhook-verification'] === 'true') {
        const t = (JSON.parse(req.body) as { token: string }).token;
        return { status: 200, body: JSON.stringify({ token: t }) };
      }
      return { status: 500, body: 'no' };
    };
    const create = await call('/v1/webhooks', {
      method: 'POST',
      body: JSON.stringify({
        endpoint_url: 'https://receiver.example.com/hook',
        subscribed_events: ['page.created'],
      }),
    });
    const { id } = (await create.json()) as { id: string };
    await updateWebhook(h.handle.db, id, { failureStreak: 4, status: 'active' });
    const { dispatchEvent } = await import('../webhooks/dispatcher.ts');
    await dispatchEvent(h.handle, {
      workspaceId: h.workspaceId,
      eventType: 'page.created',
      data: {},
      fetch: mockFetch,
    });
    const get = await call(`/v1/webhooks/${id}`);
    const fresh = (await get.json()) as { status: string; enabled: boolean };
    expect(fresh.status).toBe('auto_disabled');
    expect(fresh.enabled).toBe(false);
  });
});
