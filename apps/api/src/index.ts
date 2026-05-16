import { serve } from '@hono/node-server';
import { openDb, runMigrations } from '@bloc/db';
import { createLogger, initTracing } from '@bloc/observability';
import { createApp } from './server.ts';

const logger = createLogger('bloc-api');

async function main(): Promise<void> {
  await initTracing({ serviceName: 'bloc-api', serviceVersion: '0.0.0' });

  const handle = await openDb();
  await runMigrations(handle);
  logger.info({ driver: handle.driver }, 'database ready');

  const app = createApp({ logger, handle });
  const port = Number(process.env['API_PORT'] ?? 3001);

  serve({ fetch: app.fetch, port }, (info) => {
    logger.info({ port: info.port }, 'api listening');
  });

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    logger.info({ signal }, 'shutting down');
    await handle.close();
    process.exit(0);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

main().catch((err: unknown) => {
  logger.error({ err }, 'api failed to start');
  process.exit(1);
});