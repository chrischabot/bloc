import { expect, test } from '@playwright/test';

test.describe('smoke @smoke', () => {
  test('api health endpoint returns ok', async ({ request }) => {
    const url = process.env['API_BASE_URL'] ?? 'http://localhost:3001';
    const res = await request.get(`${url}/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
