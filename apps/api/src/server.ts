import type { ClientHandle } from '@bloc/db';
import {
  type Logger,
  httpRequestDurationSeconds,
  httpRequestsTotal,
  renderMetrics,
} from '@bloc/observability';
import { LATEST_VERSION } from '@bloc/shared';
import { Hono } from 'hono';
import { makeAuthMiddleware } from './middleware/auth.ts';
import { makeErrorHandler } from './middleware/error.ts';
import { notionVersionMiddleware } from './middleware/notion-version.ts';
import { makeRateLimitMiddleware } from './middleware/rate-limit.ts';
import { createAIRouter } from './routes/ai.ts';
import { createAnalyticsRouter } from './routes/analytics.ts';
import { createAuditRouter } from './routes/audit.ts';
import { createAuthRouter } from './routes/auth.ts';
import { createAutomationsRouter } from './routes/automations.ts';
import { createBacklinksRouter } from './routes/backlinks.ts';
import { createBlocksRouter } from './routes/blocks.ts';
import { createBootstrapRouter } from './routes/bootstrap.ts';
import { createButtonsRouter } from './routes/buttons.ts';
import { createChartsRouter } from './routes/charts.ts';
import { createCommentsRouter } from './routes/comments.ts';
import { createDataSourcesRouter } from './routes/data-sources.ts';
import { createDatabasesRouter } from './routes/databases.ts';
import { createDatabaseExportsRouter, createExportsRouter } from './routes/exports.ts';
import {
  createFormSubmissionsRouter,
  createFormsRouter,
  createPublicFormsRouter,
} from './routes/forms.ts';
import { createImportsRouter } from './routes/imports.ts';
import { createInboxRouter } from './routes/inbox.ts';
import { createIntegrationsRouter } from './routes/integrations.ts';
import { createInternalV3Router } from './routes/internal-v3.ts';
import { createOAuthRouter } from './routes/oauth.ts';
import { createPagesRouter } from './routes/pages.ts';
import { createPermissionsRouter } from './routes/permissions.ts';
import { createRealtimeRouter } from './routes/realtime.ts';
import { createRemindersRouter } from './routes/reminders.ts';
import { createSearchRouter } from './routes/search.ts';
import {
  createCustomDomainsRouter,
  createPublicSitesRouter,
  createPublicationsRouter,
} from './routes/sites.ts';
import { createUsersRouter } from './routes/users.ts';
import { createVersionsRouter } from './routes/versions.ts';
import { createWebhooksRouter } from './routes/webhooks.ts';
import { createWikisRouter } from './routes/wikis.ts';
import { createWorkspaceMembersRouter } from './routes/workspace-members.ts';
import { type Emitter, makeEmitter } from './webhooks/emit.ts';
import './types.ts';

export interface AppDeps {
  logger: Logger;
  handle?: ClientHandle;
  /** Optional fetch override (used by webhook tests). */
  webhookFetch?: typeof fetch;
  /** Optional preconstructed emitter; if omitted, an emitter is built from `webhookFetch`. */
  emit?: Emitter;
}

type AppVariables = {
  requestId: string;
};

export type App = Hono<{ Variables: AppVariables }>;

/** Path-conditional auth: returns true if the request must carry a bearer. */
function requiresAuth(path: string): boolean {
  // Bootstrap, OAuth/email auth, public site reads, and public form submissions
  // are anonymous. Every other /v1 path requires auth.
  if (path === '/v1/bootstrap') return false;
  if (path.startsWith('/v1/auth/')) return false;
  if (path.startsWith('/v1/sites/')) return false;
  // /v1/forms/:viewId/submissions is public. Other /v1/forms/* paths
  // (CRUD on form views, list submissions) require auth.
  if (/^\/v1\/forms\/[^/]+\/submissions$/.test(path)) return false;
  return path.startsWith('/v1/');
}

export function createApp(deps: AppDeps): App {
  const app = new Hono<{ Variables: AppVariables }>();

  app.use('*', async (c, next) => {
    const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
    c.set('requestId', requestId);
    c.header('x-request-id', requestId);
    c.header('notion-version', LATEST_VERSION);

    const start = performance.now();
    try {
      await next();
    } finally {
      const durationSec = (performance.now() - start) / 1000;
      const route = c.req.routePath ?? c.req.path;
      const status = String(c.res.status);
      const method = c.req.method;
      httpRequestsTotal.inc({ method, route, status });
      httpRequestDurationSeconds.observe({ method, route }, durationSec);
      deps.logger.info(
        { requestId, method, route, status, durationMs: Math.round(durationSec * 1000) },
        'request completed',
      );
    }
  });

  app.get('/health', (c) =>
    c.json({
      object: 'health',
      status: 'ok',
      version: LATEST_VERSION,
      ts: new Date().toISOString(),
    }),
  );

  app.get('/metrics', async (c) => {
    const body = await renderMetrics();
    c.header('content-type', 'text/plain; version=0.0.4; charset=utf-8');
    return c.body(body);
  });

  if (deps.handle !== undefined) {
    const emit = deps.emit ?? makeEmitter(deps.handle, deps.webhookFetch);

    // Shared middleware applied to every /v1 path.
    app.use('/v1/*', notionVersionMiddleware);
    app.use('/v1/*', makeRateLimitMiddleware());

    // Path-conditional auth middleware.
    const authMw = makeAuthMiddleware(deps.handle);
    app.use('/v1/*', async (c, next) => {
      if (!requiresAuth(c.req.path)) return next();
      return authMw(c, next);
    });

    // Public routes.
    app.route('/v1/auth', createAuthRouter());
    app.route('/v1/auth', createOAuthRouter({ handle: deps.handle }));
    app.route('/v1/bootstrap', createBootstrapRouter({ handle: deps.handle }));
    app.route('/v1/forms', createPublicFormsRouter({ handle: deps.handle, emit }));
    app.route('/v1/sites', createPublicSitesRouter({ handle: deps.handle }));

    // Authenticated routes.
    app.route('/v1/blocks', createBlocksRouter({ handle: deps.handle, emit }));
    app.route('/v1/pages', createPagesRouter({ handle: deps.handle, emit }));
    app.route('/v1/pages', createPermissionsRouter({ handle: deps.handle }));
    app.route('/v1/pages', createBacklinksRouter({ handle: deps.handle }));
    app.route('/v1/pages', createPublicationsRouter({ handle: deps.handle, emit }));
    app.route('/v1/pages', createWikisRouter({ handle: deps.handle, emit }));
    app.route('/v1/pages', createVersionsRouter({ handle: deps.handle }));
    app.route('/v1/pages', createExportsRouter({ handle: deps.handle }));
    app.route('/v1/databases', createDatabasesRouter({ handle: deps.handle, emit }));
    app.route('/v1/databases', createDatabaseExportsRouter({ handle: deps.handle }));
    app.route('/v1/users', createUsersRouter({ handle: deps.handle }));
    app.route('/v1/comments', createCommentsRouter({ handle: deps.handle, emit }));
    app.route('/v1/search', createSearchRouter({ handle: deps.handle }));
    app.route('/v1/integrations', createIntegrationsRouter({ handle: deps.handle }));
    app.route('/v1/workspaces', createWorkspaceMembersRouter({ handle: deps.handle }));
    app.route('/v1/workspaces', createAuditRouter({ handle: deps.handle }));
    app.route('/v1/workspaces', createCustomDomainsRouter({ handle: deps.handle }));
    app.route('/v1/buttons', createButtonsRouter({ handle: deps.handle, emit }));
    app.route('/v1/charts', createChartsRouter({ handle: deps.handle }));
    app.route('/v1', createAutomationsRouter({ handle: deps.handle, emit }));
    app.route('/v1', createDataSourcesRouter({ handle: deps.handle }));
    app.route('/v1/forms', createFormsRouter({ handle: deps.handle }));
    app.route('/v1/forms', createFormSubmissionsRouter({ handle: deps.handle }));
    app.route('/v1/ai', createAIRouter({ handle: deps.handle }));
    app.route('/v1/realtime', createRealtimeRouter({ handle: deps.handle }));
    const webhookArgs: Parameters<typeof createWebhooksRouter>[0] = { handle: deps.handle };
    if (deps.webhookFetch !== undefined) webhookArgs.fetch = deps.webhookFetch;
    app.route('/v1/webhooks', createWebhooksRouter(webhookArgs));
    app.route('/v1/analytics', createAnalyticsRouter({ handle: deps.handle }));
    app.route('/v1/reminders', createRemindersRouter({ handle: deps.handle }));
    app.route('/v1/inbox', createInboxRouter({ handle: deps.handle }));
    app.route('/v1/imports', createImportsRouter({ handle: deps.handle, emit }));

    // Internal v3 API — always authenticated.
    app.use('/api/v3/*', notionVersionMiddleware);
    app.use('/api/v3/*', authMw);
    app.route('/api/v3', createInternalV3Router({ handle: deps.handle }));
  }

  app.notFound((c) =>
    c.json(
      {
        object: 'error',
        status: 404,
        code: 'object_not_found',
        message: `Route not found: ${c.req.path}`,
        request_id: c.get('requestId'),
      },
      404,
    ),
  );

  app.onError(makeErrorHandler(deps.logger));

  return app;
}