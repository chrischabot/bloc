import { afterEach, describe, expect, it, vi } from 'vitest';
import { type DigestEnv, type DueReminder, groupByUser, tick } from './email-digest.ts';

describe('email digest helpers', () => {
  it('groups reminders by user_id', () => {
    const grouped = groupByUser([
      { id: 'r1', user_id: 'u1', due_at: '2026-05-16T10:00:00Z', label: 'a' },
      { id: 'r2', user_id: 'u2', due_at: '2026-05-16T11:00:00Z', label: 'b' },
      { id: 'r3', user_id: 'u1', due_at: '2026-05-16T12:00:00Z', label: 'c' },
    ]);
    expect(grouped.get('u1')).toHaveLength(2);
    expect(grouped.get('u2')).toHaveLength(1);
  });

  it('returns empty map for empty input', () => {
    expect(groupByUser([]).size).toBe(0);
  });
});

describe('email digest tick', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns zero counts when bearer is missing', async () => {
    const env: DigestEnv = {
      apiBase: 'http://stub',
      bearer: '',
      pollIntervalMs: 1000,
      notionVersion: '2026-04-01',
    };
    const result = await tick(env);
    expect(result).toEqual({ scanned: 0, fired: 0, failed: 0, users: 0 });
  });

  it('scans + fires each due reminder', async () => {
    const due: DueReminder[] = [
      { id: 'r1', user_id: 'u1', due_at: '2026-05-16T10:00:00Z', label: 'a' },
      { id: 'r2', user_id: 'u2', due_at: '2026-05-16T11:00:00Z', label: 'b' },
      { id: 'r3', user_id: 'u1', due_at: '2026-05-16T12:00:00Z', label: 'c' },
    ];
    const fetched: { url: string; method: string }[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      fetched.push({ url, method: init?.method ?? 'GET' });
      if (url.endsWith('/v1/reminders/scan-due')) {
        return new Response(JSON.stringify({ results: due }), { status: 200 });
      }
      if (url.includes('/fire')) {
        return new Response('', { status: 200 });
      }
      return new Response('', { status: 404 });
    });

    const env: DigestEnv = {
      apiBase: 'http://stub',
      bearer:
        'Bearer test_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      pollIntervalMs: 1000,
      notionVersion: '2026-04-01',
    };
    const result = await tick(env);
    expect(result.scanned).toBe(3);
    expect(result.fired).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.users).toBe(2);
    // One scan + one fire per reminder.
    expect(fetched.filter((f) => f.url.includes('/scan-due'))).toHaveLength(1);
    expect(fetched.filter((f) => f.url.includes('/fire'))).toHaveLength(3);
  });

  it('counts failures separately when fire returns non-2xx', async () => {
    const due: DueReminder[] = [
      { id: 'good', user_id: 'u1', due_at: '...', label: null },
      { id: 'bad', user_id: 'u1', due_at: '...', label: null },
    ];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/v1/reminders/scan-due')) {
        return new Response(JSON.stringify({ results: due }), { status: 200 });
      }
      if (url.includes('/bad/fire')) {
        return new Response('', { status: 500 });
      }
      if (url.includes('/fire')) {
        return new Response('', { status: 200 });
      }
      void init;
      return new Response('', { status: 404 });
    });

    const env: DigestEnv = {
      apiBase: 'http://stub',
      bearer:
        'Bearer test_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      pollIntervalMs: 1000,
      notionVersion: '2026-04-01',
    };
    const result = await tick(env);
    expect(result.fired).toBe(1);
    expect(result.failed).toBe(1);
  });
});
