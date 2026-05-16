import {
  type ClientHandle,
  addMember,
  createIntegration,
  createPage,
  createUser,
  createWorkspace,
  openDb,
  resetIntegrationVerifyCache,
  runMigrations,
} from '@bloc/db';
import { createLogger } from '@bloc/observability';
import { drainBacklinksReindex } from './backlinks/reindex.ts';
import { makeTestBearer } from './middleware/auth.ts';
import { resetRateLimitBuckets } from './middleware/rate-limit.ts';
import { type App, createApp } from './server.ts';
import { type Emitter, makeEmitter } from './webhooks/emit.ts';

export interface TestHarness {
  app: App;
  handle: ClientHandle;
  bearer: string;
  workspaceId: string;
  userId: string;
  page: { id: string };
  fetch: typeof fetch;
  emit: Emitter;
  mintIntegration: (
    name?: string,
    capabilities?: string[],
  ) => Promise<{ id: string; bearer: string; raw: string }>;
}

export interface BootOptions {
  webhookFetch?: typeof fetch;
}

export async function bootTestHarness(opts: BootOptions = {}): Promise<TestHarness> {
  process.env['RATE_LIMIT_DISABLE'] = '1';
  process.env['AUTH_DELIVERY'] = 'test';
  resetRateLimitBuckets();
  resetIntegrationVerifyCache();

  const handle = await openDb();
  await runMigrations(handle);
  const logger = createLogger('bloc-api-test', {
    level: process.env['TEST_LOG_LEVEL'] ?? 'silent',
  });
  const emit = makeEmitter(handle, opts.webhookFetch);
  const appArgs: Parameters<typeof createApp>[0] = { logger, handle, emit };
  if (opts.webhookFetch !== undefined) appArgs.webhookFetch = opts.webhookFetch;
  const app = createApp(appArgs);

  const user = await createUser(handle.db, {
    email: `t${Date.now()}@local`,
    name: 'Tester',
    type: 'person',
  });
  const ws = await createWorkspace(handle.db, { name: 'T', plan: 'free' });
  await addMember(handle.db, { workspaceId: ws.id, userId: user.id, role: 'owner' });
  const page = await createPage(handle.db, {
    workspaceId: ws.id,
    parentType: 'workspace',
    createdBy: user.id,
    lastEditedBy: user.id,
  });

  const bearer = makeTestBearer(ws.id, user.id);

  const fetcher: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const merged: RequestInit = init ?? {};
    return app.request(url, merged);
  };

  return {
    app,
    handle,
    bearer,
    workspaceId: ws.id,
    userId: user.id,
    page: { id: page.id },
    fetch: fetcher,
    emit,
    async mintIntegration(
      name = 'test integration',
      capabilities = ['read_content', 'update_content'],
    ) {
      const result = await createIntegration(handle.db, {
        workspaceId: ws.id,
        ownerUserId: user.id,
        name,
        capabilities,
      });
      return {
        id: result.integration.id,
        raw: result.token,
        bearer: `Bearer ${result.token}`,
      };
    },
  };
}

/**
 * Drain every async background task (webhook deliveries, backlinks reindexes)
 * then close the PGlite handle. Tests should prefer this over
 * `harness.handle.close()` to avoid WASM races when the DB is torn down while
 * background fetches are still in flight.
 */
export async function closeHarness(harness: TestHarness): Promise<void> {
  await harness.emit.drain();
  await drainBacklinksReindex();
  await harness.handle.close();
}
