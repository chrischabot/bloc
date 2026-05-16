import { LATEST_VERSION, type NotionVersion, isSupportedVersion } from '@bloc/shared';
import type { MiddlewareHandler } from 'hono';

declare module 'hono' {
  interface ContextVariableMap {
    notionVersion: NotionVersion;
  }
}

/** Validate the `Notion-Version` header per docs/api/05-versioning.md. */
export const notionVersionMiddleware: MiddlewareHandler = async (c, next) => {
  const requested = c.req.header('notion-version') ?? LATEST_VERSION;
  if (!isSupportedVersion(requested)) {
    return c.json(
      {
        object: 'error',
        status: 400,
        code: 'invalid_request',
        message: `Unsupported Notion-Version: ${requested}`,
        request_id: c.get('requestId'),
        details: [{ path: 'headers.notion-version', issue: 'unsupported_version' }],
      },
      400,
    );
  }
  c.set('notionVersion', requested);
  c.header('notion-version', requested);
  await next();
};
