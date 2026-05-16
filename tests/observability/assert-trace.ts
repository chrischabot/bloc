import { type Span, context, trace } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  type ReadableSpan,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';

/** Captured span record. */
export interface CapturedSpan {
  name: string;
  attributes: Record<string, unknown>;
  status: { code: number; message?: string };
  events: { name: string; attributes?: Record<string, unknown> }[];
}

const captured: CapturedSpan[] = [];
let installed = false;

/**
 * Install the in-memory exporter for the duration of the test process.
 * Idempotent; calling more than once is a no-op.
 */
export function installInMemoryTraceExporter(): void {
  if (installed) return;
  installed = true;

  const exporter = new InMemorySpanExporter();
  const originalExport = exporter.export.bind(exporter);
  exporter.export = (spans: ReadableSpan[], resultCallback) => {
    for (const s of spans) {
      const status: CapturedSpan['status'] = { code: s.status.code };
      if (s.status.message !== undefined) status.message = s.status.message;
      captured.push({
        name: s.name,
        attributes: { ...s.attributes },
        status,
        events: s.events.map((e) => {
          const evt: { name: string; attributes?: Record<string, unknown> } = { name: e.name };
          if (e.attributes !== undefined) evt.attributes = { ...e.attributes };
          return evt;
        }),
      });
    }
    originalExport(spans, resultCallback);
  };

  const provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  provider.register();
}

/** Reset the captured span buffer. */
export function resetCapturedSpans(): void {
  captured.length = 0;
}

/** Get a defensive copy of all captured spans so far. */
export function getCapturedSpans(): CapturedSpan[] {
  return captured.slice();
}

/** Assert a span with `name` was captured, optionally with matching attributes. */
export function assertSpan(name: string, attrs: Record<string, unknown> = {}): CapturedSpan {
  const match = captured.find(
    (s) => s.name === name && Object.entries(attrs).every(([k, v]) => s.attributes[k] === v),
  );
  if (!match) {
    const candidates = captured.filter((s) => s.name === name);
    throw new Error(
      `assertSpan: no span "${name}" matched attributes ${JSON.stringify(attrs)}. ` +
        `Candidates: ${JSON.stringify(candidates.map((c) => c.attributes))}`,
    );
  }
  return match;
}

/** Convenience: run `fn` and ensure it produced the expected span. */
export async function withCapturedSpan<T>(
  spanName: string,
  attrs: Record<string, unknown>,
  fn: () => Promise<T> | T,
): Promise<T> {
  const before = captured.length;
  const result = await fn();
  if (!captured.slice(before).some((s) => s.name === spanName)) {
    throw new Error(`Expected span "${spanName}" was not emitted`);
  }
  if (Object.keys(attrs).length > 0) assertSpan(spanName, attrs);
  return result;
}

export { context, trace, type Span };
