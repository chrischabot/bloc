import { hostname } from 'node:os';
import { type LoggerOptions, type Logger as PinoLogger, pino } from 'pino';

export type Logger = PinoLogger;

const baseFields = {
  hostname: hostname(),
  pid: process.pid,
};

/**
 * Create a service-scoped pino logger.
 *
 * Required fields auto-populated on every line:
 * `time`, `level`, `msg`, `service`, `hostname`, `pid`.
 *
 * Callers add per-request fields via `logger.child({ requestId, traceId, ... })`.
 */
export function createLogger(service: string, options: LoggerOptions = {}): Logger {
  const level =
    process.env['LOG_LEVEL'] ?? (process.env['NODE_ENV'] === 'production' ? 'info' : 'debug');
  return pino({
    level,
    base: { service, ...baseFields },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-csrf-token"]',
        '*.password',
        '*.token',
        '*.secret',
        '*.signing_secret',
      ],
      remove: true,
    },
    ...options,
  });
}
