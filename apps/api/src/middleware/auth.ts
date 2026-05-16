import { type ClientHandle, findIntegrationByToken } from '@bloc/db';
import type { MiddlewareHandler } from 'hono';

export interface Actor {
  userId: string;
  workspaceId: string;
  /** Identifier for rate-limit + audit when authenticated as an integration. */
  integrationId?: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    actor: Actor;
  }
}

const TEST_BEARER_RE = /^Bearer\s+test_([0-9a-f-]{36})_([0-9a-f-]{36})$/;
const REAL_BEARER_RE = /^Bearer\s+(secret_[A-Za-z0-9_-]{43,})$/;

/**
 * Auth middleware. Supports two bearer formats:
 *   - `Bearer test_<workspaceId>_<userId>` — Phase 2 stub (tests only).
 *   - `Bearer secret_<43+ chars>` — integration token persisted in
 *     `integrations` with sha256 hash.
 */
export function makeAuthMiddleware(handle: ClientHandle): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header('authorization') ?? '';
    const testMatch = TEST_BEARER_RE.exec(header);
    if (testMatch) {
      const workspaceId = testMatch[1] ?? '';
      const userId = testMatch[2] ?? '';
      c.set('actor', { workspaceId, userId });
      return next();
    }
    const realMatch = REAL_BEARER_RE.exec(header);
    if (realMatch) {
      const token = realMatch[1] as string;
      const integration = await findIntegrationByToken(handle.db, token);
      if (integration !== null) {
        const actor: Actor = {
          workspaceId: integration.workspaceId,
          userId: integration.ownerUserId,
          integrationId: integration.id,
        };
        c.set('actor', actor);
        return next();
      }
    }
    return c.json(
      {
        object: 'error',
        status: 401,
        code: 'unauthorized',
        message: 'Missing or invalid bearer token',
        request_id: c.get('requestId'),
      },
      401,
    );
  };
}

/** Format a Phase-2 test bearer for a given (workspace, user). */
export function makeTestBearer(workspaceId: string, userId: string): string {
  return `Bearer test_${workspaceId}_${userId}`;
}
