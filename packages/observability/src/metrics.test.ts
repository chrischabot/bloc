import { describe, expect, it } from 'vitest';
import { httpRequestsTotal, renderMetrics } from './metrics.ts';

describe('metrics', () => {
  it('increments a counter and renders it', async () => {
    httpRequestsTotal.inc({ method: 'GET', route: '/health', status: '200' });
    const text = await renderMetrics();
    expect(text).toContain('http_requests_total');
    expect(text).toMatch(/method="GET"/);
  });

  it('renders the prometheus content type header convention', async () => {
    const text = await renderMetrics();
    // OpenMetrics / Prometheus exposition format starts with HELP/TYPE comments
    expect(text).toMatch(/^# HELP /m);
    expect(text).toMatch(/^# TYPE /m);
  });
});
