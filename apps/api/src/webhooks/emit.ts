import type { ClientHandle } from '@bloc/db';
import { createLogger } from '@bloc/observability';
import { type DispatchResult, dispatchEvent } from './dispatcher.ts';

interface EmitArgs {
  workspaceId: string;
  type: string;
  data: Record<string, unknown>;
}

export interface Emitter {
  (args: EmitArgs): Promise<void>;
  /** Wait for every outstanding dispatch to settle. */
  drain(): Promise<void>;
}

const logger = createLogger('webhooks.emit');

/**
 * Build a webhook emitter bound to a handle + optional fetch override.
 * The returned function is fire-and-forget: errors are swallowed so an event
 * fan-out failure never breaks a mutation response. Every dispatch logs at
 * `debug` on success and `warn` on swallowed failure for observability.
 * Callers that need to guarantee dispatch completion (tests, benchmark
 * cleanup) can call `emit.drain()` to await all in-flight deliveries.
 */
export function makeEmitter(handle: ClientHandle, fetchImpl?: typeof fetch): Emitter {
  const inFlight = new Set<Promise<void>>();
  const emitter = (async (args: EmitArgs): Promise<void> => {
    const promise = (async (): Promise<void> => {
      try {
        const result: DispatchResult = await dispatchEvent(handle, {
          workspaceId: args.workspaceId,
          eventType: args.type,
          data: args.data,
          ...(fetchImpl !== undefined ? { fetch: fetchImpl } : {}),
        });
        logger.debug(
          {
            workspaceId: args.workspaceId,
            eventType: args.type,
            delivered: result.delivered,
            succeeded: result.succeeded,
            failed: result.failed,
          },
          'webhook event dispatched',
        );
      } catch (err) {
        // Webhook delivery failure must never break the originating mutation,
        // but we surface it via structured logging.
        logger.warn(
          { workspaceId: args.workspaceId, eventType: args.type, err },
          'webhook event dispatch threw',
        );
      }
    })();
    inFlight.add(promise);
    try {
      await promise;
    } finally {
      inFlight.delete(promise);
    }
  }) as Emitter;

  emitter.drain = async (): Promise<void> => {
    while (inFlight.size > 0) {
      await Promise.allSettled([...inFlight]);
    }
  };

  return emitter;
}
