import { rateLimitExceededTotal } from '@bloc/observability';
import type { MiddlewareHandler } from 'hono';

interface BucketState {
  tokens: number;
  refilledAt: number;
}

interface BucketConfig {
  capacity: number;
  refillPerSec: number;
}

interface RateLimitOptions {
  /** Per-identity-type default config. */
  defaults: {
    integration: BucketConfig;
    session: BucketConfig;
    anonymous: BucketConfig;
  };
  /** Per-route override (matches `c.req.routePath`). */
  routeOverrides?: Record<
    string,
    Partial<{ integration: BucketConfig; session: BucketConfig; anonymous: BucketConfig }>
  >;
}

const PHASE_6_DEFAULTS: RateLimitOptions = {
  defaults: {
    integration: { capacity: 30, refillPerSec: 3 },
    session: { capacity: 300, refillPerSec: 30 },
    anonymous: { capacity: 5, refillPerSec: 1 },
  },
  routeOverrides: {
    '/v1/search': { integration: { capacity: 5, refillPerSec: 1 } },
    '/v1/databases/:id/query': { integration: { capacity: 10, refillPerSec: 2 } },
  },
};

/** Process-wide bucket state. */
const BUCKETS = new Map<string, BucketState>();

function configFor(
  options: RateLimitOptions,
  identityType: 'integration' | 'session' | 'anonymous',
  routePath: string,
): BucketConfig {
  const override = options.routeOverrides?.[routePath];
  if (override !== undefined && override[identityType] !== undefined) {
    return override[identityType] as BucketConfig;
  }
  return options.defaults[identityType];
}

function takeToken(
  key: string,
  cfg: BucketConfig,
  now: number,
): { allowed: boolean; remaining: number; resetSec: number } {
  let bucket = BUCKETS.get(key);
  if (bucket === undefined) {
    bucket = { tokens: cfg.capacity, refilledAt: now };
    BUCKETS.set(key, bucket);
  }
  const elapsedSec = (now - bucket.refilledAt) / 1000;
  bucket.tokens = Math.min(cfg.capacity, bucket.tokens + elapsedSec * cfg.refillPerSec);
  bucket.refilledAt = now;
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      resetSec: 0,
    };
  }
  const deficit = 1 - bucket.tokens;
  const resetSec = Math.max(1, Math.ceil(deficit / cfg.refillPerSec));
  return { allowed: false, remaining: 0, resetSec };
}

/** Reset all buckets (for tests). */
export function resetRateLimitBuckets(): void {
  BUCKETS.clear();
}

/** Create the rate-limit middleware. Pass `options` to customise. */
export function makeRateLimitMiddleware(
  options: RateLimitOptions = PHASE_6_DEFAULTS,
): MiddlewareHandler {
  return async (c, next) => {
    if (process.env['RATE_LIMIT_DISABLE'] === '1') return next();
    const actor = c.get('actor');
    const identityType: 'integration' | 'session' | 'anonymous' =
      actor !== undefined && actor !== null
        ? actor.integrationId !== undefined
          ? 'integration'
          : 'session'
        : 'anonymous';
    const identityId =
      actor?.integrationId ?? actor?.userId ?? c.req.header('x-forwarded-for') ?? 'anon';
    const routePath = c.req.routePath ?? c.req.path;
    const cfg = configFor(options, identityType, routePath);
    const now = Date.now();
    const { allowed, remaining, resetSec } = takeToken(
      `${identityType}:${identityId}:${routePath}`,
      cfg,
      now,
    );

    c.header('x-ratelimit-limit', String(cfg.capacity));
    c.header('x-ratelimit-remaining', String(remaining));
    c.header('x-ratelimit-reset', String(Math.floor(now / 1000) + resetSec));

    if (!allowed) {
      rateLimitExceededTotal.inc({ identity_type: identityType });
      c.header('retry-after', String(resetSec));
      return c.json(
        {
          object: 'error',
          status: 429,
          code: 'rate_limited',
          message: `Too many requests. Retry after ${resetSec} seconds.`,
          request_id: c.get('requestId'),
        },
        429,
      );
    }
    return next();
  };
}
