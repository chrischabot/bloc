import { randomBytes } from 'node:crypto';
import { withSpan } from '@bloc/observability';
import { BlocValidationError } from '@bloc/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import './../types.ts';

interface PendingMagicLink {
  email: string;
  token: string;
  expiresAt: number;
}

/** In-memory token store. v1.1 will swap to Redis. */
const PENDING = new Map<string, PendingMagicLink>();

const StartSchema = z.object({ email: z.string().email() }).strict();

export function resetMagicLinks(): void {
  PENDING.clear();
}

/**
 * Email magic-link auth router. The route currently uses an in-memory pending
 * token store with a 15-minute expiry; production swaps in Redis + Resend in
 * v1.1. Set env `AUTH_DELIVERY=test` to return the token in the response so
 * tests can complete the callback without a real email.
 */
export function createAuthRouter(): Hono {
  const router = new Hono();

  router.post('/email/start', async (c) => {
    const body = StartSchema.parse(await c.req.json());
    return withSpan('auth', 'auth.email.start', {}, async () => {
      const token = randomBytes(32).toString('base64url');
      const expiresAt = Date.now() + 15 * 60 * 1000;
      PENDING.set(token, { email: body.email, token, expiresAt });
      if (process.env['AUTH_DELIVERY'] === 'test') {
        return c.json({ object: 'auth_start', delivery: 'test', token });
      }
      c.status(204);
      return c.body(null);
    });
  });

  router.get('/email/callback', async (c) => {
    const url = new URL(c.req.url);
    const token = url.searchParams.get('token');
    const requestId = c.get('requestId');
    if (token === null) throw new BlocValidationError('token required', requestId);
    const pending = PENDING.get(token);
    if (!pending) throw new BlocValidationError('invalid token', requestId);
    if (pending.expiresAt < Date.now()) {
      PENDING.delete(token);
      throw new BlocValidationError('token expired', requestId);
    }
    PENDING.delete(token);
    return c.json({ object: 'auth_session', email: pending.email });
  });

  router.post('/logout', async (c) => {
    c.status(204);
    return c.body(null);
  });

  return router;
}
