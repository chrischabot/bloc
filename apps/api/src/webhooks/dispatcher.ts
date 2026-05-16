import { randomUUID } from 'node:crypto';
import {
  type ClientHandle,
  type Webhook,
  listActiveWebhooksForEvent,
  recordDelivery,
  updateWebhook,
} from '@bloc/db';
import { HEADER_SIGNATURE, HEADER_VERIFICATION, signBody } from './signing.ts';

const TIMEOUT_MS = 10_000;
const AUTO_DISABLE_AT_STREAK = 5;

export interface DispatchResult {
  delivered: number;
  succeeded: number;
  failed: number;
}

export interface VerificationResult {
  ok: boolean;
  status: number;
  body: string;
  error?: string;
}

/** Fire-and-record dispatch for a single workspace event. */
export async function dispatchEvent(
  handle: ClientHandle,
  args: {
    workspaceId: string;
    eventType: string;
    data: unknown;
    /** Optional explicit fetch (tests). */
    fetch?: typeof fetch;
  },
): Promise<DispatchResult> {
  const subscribers = await listActiveWebhooksForEvent(handle.db, args.workspaceId, args.eventType);
  let succeeded = 0;
  let failed = 0;
  for (const sub of subscribers) {
    const ok = await deliverOne(handle, sub, args.eventType, args.data, args.fetch);
    if (ok) succeeded += 1;
    else failed += 1;
  }
  return { delivered: subscribers.length, succeeded, failed };
}

async function deliverOne(
  handle: ClientHandle,
  webhook: Webhook,
  eventType: string,
  data: unknown,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<boolean> {
  const eventId = randomUUID();
  const payload = {
    id: eventId,
    type: eventType,
    occurred_at: new Date().toISOString(),
    workspace_id: webhook.workspaceId,
    data,
    delivery_attempt: 1,
  };
  const rawBody = JSON.stringify(payload);
  const signature = signBody(webhook.signingSecret, rawBody);
  const t0 = performance.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetchImpl(webhook.endpointUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [HEADER_SIGNATURE]: signature,
      },
      body: rawBody,
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const latencyMs = Math.round(performance.now() - t0);
    const responseBody = (await res.text()).slice(0, 4000);
    const ok = res.status >= 200 && res.status < 300;
    await recordDelivery(handle.db, {
      webhookId: webhook.id,
      eventId,
      eventType,
      status: ok ? 'success' : 'failed',
      httpStatus: res.status,
      latencyMs,
      requestBody: payload,
      responseBody,
    });
    await updateWebhook(handle.db, webhook.id, {
      failureStreak: ok ? 0 : webhook.failureStreak + 1,
      ...(!ok && webhook.failureStreak + 1 >= AUTO_DISABLE_AT_STREAK
        ? { status: 'auto_disabled', enabled: false }
        : {}),
    });
    return ok;
  } catch (err) {
    const latencyMs = Math.round(performance.now() - t0);
    await recordDelivery(handle.db, {
      webhookId: webhook.id,
      eventId,
      eventType,
      status: 'failed',
      latencyMs,
      requestBody: payload,
      error: (err as Error).message,
    });
    await updateWebhook(handle.db, webhook.id, {
      failureStreak: webhook.failureStreak + 1,
      ...(webhook.failureStreak + 1 >= AUTO_DISABLE_AT_STREAK
        ? { status: 'auto_disabled', enabled: false }
        : {}),
    });
    return false;
  }
}

/** Send the one-off verification handshake to a webhook's endpoint. */
export async function performVerification(
  handle: ClientHandle,
  webhook: Webhook,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<VerificationResult> {
  const token = randomUUID();
  const payload = { type: 'verification', token, webhook_id: webhook.id };
  const rawBody = JSON.stringify(payload);
  const signature = signBody(webhook.signingSecret, rawBody);
  const t0 = performance.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetchImpl(webhook.endpointUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [HEADER_SIGNATURE]: signature,
        [HEADER_VERIFICATION]: 'true',
      },
      body: rawBody,
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const responseText = await res.text();
    const latencyMs = Math.round(performance.now() - t0);
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = null;
    }
    const ok =
      res.status >= 200 &&
      res.status < 300 &&
      parsed !== null &&
      typeof parsed === 'object' &&
      (parsed as { token?: unknown }).token === token;
    await recordDelivery(handle.db, {
      webhookId: webhook.id,
      eventId: randomUUID(),
      eventType: 'verification',
      status: ok ? 'success' : 'failed',
      httpStatus: res.status,
      latencyMs,
      requestBody: payload,
      responseBody: responseText.slice(0, 4000),
    });
    if (ok) {
      await updateWebhook(handle.db, webhook.id, { status: 'active' });
    }
    return { ok, status: res.status, body: responseText };
  } catch (err) {
    return { ok: false, status: 0, body: '', error: (err as Error).message };
  }
}
