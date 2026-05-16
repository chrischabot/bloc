'use client';

const STORAGE_KEY = 'bloc-session';

export interface DevSession {
  user_id: string;
  workspace_id: string;
  session_bearer: string;
  user: { id: string; name: string | null; email: string; type: string };
  fetched_at: string;
}

let cached: DevSession | null = null;
let inFlight: Promise<DevSession> | null = null;

function readCached(): DevSession | null {
  if (cached !== null) return cached;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    cached = JSON.parse(raw) as DevSession;
    return cached;
  } catch {
    return null;
  }
}

function persist(session: DevSession): void {
  cached = session;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // localStorage might be disabled (private mode); keep memory cache.
    }
  }
}

/** Force-clear the cached session (used by the "Reset workspace" menu). */
export function clearSession(): void {
  cached = null;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

/**
 * Get (or fetch) the dev session. Idempotent — subsequent calls return the
 * cached session without hitting the API.
 */
export async function getDevSession(): Promise<DevSession> {
  const existing = readCached();
  if (existing !== null) return existing;
  if (inFlight !== null) return inFlight;

  inFlight = (async (): Promise<DevSession> => {
    try {
      const res = await fetch(`${apiBaseUrl()}/v1/bootstrap`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        throw new Error(`Bootstrap failed: HTTP ${res.status}`);
      }
      const body = (await res.json()) as Omit<DevSession, 'fetched_at'>;
      const session: DevSession = { ...body, fetched_at: new Date().toISOString() };
      persist(session);
      return session;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/**
 * Returns an absolute base URL for SDK construction. The SDK uses
 * `new URL(baseUrl + path)` which requires the URL to be absolute.
 * In the browser we use the current origin (Next.js rewrites proxy /v1 → API).
 * On the server (SSR / tests) we use the configured `NEXT_PUBLIC_API_URL` or
 * localhost:3001 as a fallback.
 */
export function apiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
}