import { type Span, type Tracer, trace } from '@opentelemetry/api';

let initialised = false;
let nodeSdk: unknown = null;

interface TracingOptions {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  /** Override the OTLP endpoint; defaults to OTEL_EXPORTER_OTLP_ENDPOINT or localhost:4318. */
  endpoint?: string;
  /** If false, the SDK is created but not started. Useful for tests. */
  start?: boolean;
}

/**
 * Initialise the OpenTelemetry Node SDK. Idempotent; calling twice is a no-op.
 * Returns the underlying `NodeSDK` instance for tests / advanced control.
 */
export async function initTracing(options: TracingOptions): Promise<unknown> {
  if (initialised) return nodeSdk;
  initialised = true;

  const { NodeSDK } = await import('@opentelemetry/sdk-node');
  const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
  const { Resource } = await import('@opentelemetry/resources');
  const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = await import(
    '@opentelemetry/semantic-conventions'
  );
  const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');

  const endpoint =
    options.endpoint ?? process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4318';

  const exporter = new OTLPTraceExporter({
    url: endpoint.endsWith('/v1/traces') ? endpoint : `${endpoint}/v1/traces`,
  });

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: options.serviceName,
    [ATTR_SERVICE_VERSION]: options.serviceVersion ?? '0.0.0',
    'deployment.environment': options.environment ?? process.env['NODE_ENV'] ?? 'development',
    'service.instance.id': process.env['HOSTNAME'] ?? 'local',
  });

  const sdk = new NodeSDK({
    resource,
    traceExporter: exporter,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  if (options.start !== false) {
    sdk.start();
    process.once('SIGTERM', () => {
      void sdk.shutdown();
    });
    process.once('SIGINT', () => {
      void sdk.shutdown();
    });
  }

  nodeSdk = sdk;
  return sdk;
}

/** Get a named tracer. Always safe to call; falls back to a no-op tracer pre-init. */
export function getTracer(name: string): Tracer {
  return trace.getTracer(name);
}

/**
 * Helper: run `fn` inside a span named `name`. Closes the span on return / throw.
 */
export async function withSpan<T>(
  tracerName: string,
  spanName: string,
  attributes: Record<string, string | number | boolean>,
  fn: (span: Span) => Promise<T> | T,
): Promise<T> {
  const tracer = getTracer(tracerName);
  return tracer.startActiveSpan(spanName, { attributes }, async (span) => {
    try {
      const result = await fn(span);
      span.end();
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: 2, message: (err as Error).message });
      span.end();
      throw err;
    }
  });
}
