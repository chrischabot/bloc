'use client';

import { Bloc } from '@bloc/sdk';
import { useEffect, useMemo, useState } from 'react';
import { type DevSession, apiBaseUrl, getDevSession } from './auth.ts';

export interface UseBloc {
  client: Bloc | null;
  session: DevSession | null;
  loading: boolean;
  error: string | null;
}

export function useBloc(): UseBloc {
  const [session, setSession] = useState<DevSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getDevSession();
        if (!cancelled) {
          setSession(s);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const client = useMemo(() => {
    if (session === null) return null;
    return new Bloc({ auth: session.session_bearer, baseUrl: apiBaseUrl() });
  }, [session]);

  return { client, session, loading, error };
}
