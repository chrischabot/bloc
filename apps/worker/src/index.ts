import { createLogger, initTracing } from '@bloc/observability';
import { runEmailDigestWorker } from './email-digest.ts';

const logger = createLogger('notion-worker');

async function main(): Promise<void> {
  await initTracing({ serviceName: 'notion-worker', serviceVersion: '0.0.0' });

  logger.info('worker started');

  // Kick off the email digest scan loop.
  void runEmailDigestWorker();

  const heartbeatMs = Number(process.env['WORKER_HEARTBEAT_MS'] ?? 30_000);
  const interval = setInterval(() => {
    logger.info({ uptimeSec: process.uptime() }, 'worker heartbeat');
  }, heartbeatMs);

  const shutdown = (signal: NodeJS.Signals): void => {
    logger.info({ signal }, 'worker shutting down');
    clearInterval(interval);
    process.exit(0);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

main().catch((err: unknown) => {
  logger.error({ err }, 'worker failed to start');
  process.exit(1);
});
