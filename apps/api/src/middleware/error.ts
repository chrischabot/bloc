import type { Logger } from '@bloc/observability';
import { BlocAPIError, type BlocErrorEnvelope } from '@bloc/shared';
import type { ErrorHandler } from 'hono';
import { ZodError } from 'zod';

interface PermissionErrorLike {
  code: 'restricted_resource';
  message: string;
}

function isPermissionError(err: unknown): err is PermissionErrorLike {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'restricted_resource'
  );
}

function isJsonParseError(err: unknown): boolean {
  if (err instanceof SyntaxError) return true;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const msg = String((err as { message: unknown }).message ?? '');
    return /JSON|Unexpected (token|end of)/i.test(msg);
  }
  return false;
}

export function makeErrorHandler(logger: Logger): ErrorHandler {
  return (err, c) => {
    const requestId = c.get('requestId') ?? 'unknown';
    if (err instanceof BlocAPIError) {
      const env = err.toEnvelope();
      const safe = { ...env, request_id: requestId };
      if (env.status >= 500) {
        logger.error({ err, requestId }, 'api error (5xx)');
      } else {
        logger.warn({ code: env.code, requestId, path: c.req.path }, 'api error');
      }
      return c.json(safe, env.status as Parameters<typeof c.json>[1]);
    }
    if (err instanceof ZodError) {
      const env: BlocErrorEnvelope = {
        object: 'error',
        status: 400,
        code: 'invalid_request',
        message: 'Request validation failed',
        request_id: requestId,
        details: err.issues.map((iss) => ({
          path: iss.path.join('.'),
          issue: iss.message,
        })),
      };
      logger.warn({ code: env.code, requestId, details: env.details }, 'validation error');
      return c.json(env, 400);
    }
    if (isJsonParseError(err)) {
      const env: BlocErrorEnvelope = {
        object: 'error',
        status: 400,
        code: 'invalid_request',
        message: 'Malformed JSON request body',
        request_id: requestId,
      };
      logger.warn({ code: env.code, requestId, path: c.req.path }, 'malformed json');
      return c.json(env, 400);
    }
    if (isPermissionError(err)) {
      // Hide existence: return 404 instead of 403 (see docs/api/02-errors.md).
      const env: BlocErrorEnvelope = {
        object: 'error',
        status: 404,
        code: 'object_not_found',
        message: 'Resource not found',
        request_id: requestId,
      };
      logger.warn({ code: 'restricted_resource', requestId }, 'permission denied → 404 hide');
      return c.json(env, 404);
    }
    logger.error({ err, requestId }, 'unhandled error');
    return c.json(
      {
        object: 'error',
        status: 500,
        code: 'internal_server_error',
        message: 'Internal server error',
        request_id: requestId,
      },
      500,
    );
  };
}
