import { createLogger } from '@bloc/observability';
import { describe, expect, it } from 'vitest';
import { createApp } from './server.ts';

const logger = createLogger('bloc-api-test', { level: 'silent' });

describe('api server', () => {
  it('GET /health returns ok with version', async () => {
    const app = createApp({ logger });
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { object: string; status: string; version: string };
    expect(body.object).toBe('health');
    expect(body.status).toBe('ok');
    expect(body.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('attaches x-request-id and notion-version headers', async () => {
    const app = createApp({ logger });
    const res = await app.request('/health');
    expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers.get('notion-version')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('GET /metrics returns Prometheus text', async () => {
    const app = createApp({ logger });
    const res = await app.request('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    const text = await res.text();
    expect(text).toContain('# HELP');
  });

  it('404 returns canonical error envelope', async () => {
    const app = createApp({ logger });
    const res = await app.request('/no-such-route');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { object: string; code: string; request_id: string };
    expect(body.object).toBe('error');
    expect(body.code).toBe('object_not_found');
    expect(body.request_id).toBeTruthy();
  });
});
