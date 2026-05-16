import type { ClientHandle } from '@bloc/db';
import { reindexBacklinksForPage } from '@bloc/db';
import { createLogger } from '@bloc/observability';

const logger = createLogger('backlinks.reindex');

/**
 * In-flight reindex promises keyed by pageId. Exposed via
 * `drainBacklinksReindex()` so tests and benchmarks can deterministically
 * wait for background work before tearing down the database handle.
 */
const inFlight = new Map<string, Promise<void>>();

/**
 * Schedule a backlinks reindex of `pageId` in the background. Repeated calls
 * for the same page while a reindex is in flight are dropped — the in-flight
 * pass will read the latest committed state when it runs, so coalescing is
 * safe and avoids unbounded queue depth under mutation-heavy workloads.
 *
 * Errors are swallowed (logged) so a reindex failure never breaks the
 * mutation that triggered it.
 */
export function reindexBacklinksAsync(handle: ClientHandle, pageId: string): void {
  if (inFlight.has(pageId)) return;
  const promise = (async (): Promise<void> => {
    try {
      const count = await reindexBacklinksForPage(handle.db, pageId);
      logger.debug({ pageId, count }, 'backlinks reindexed');
    } catch (err) {
      logger.warn({ pageId, err }, 'backlinks reindex failed');
    }
  })();
  inFlight.set(pageId, promise);
  void promise.finally(() => {
    if (inFlight.get(pageId) === promise) inFlight.delete(pageId);
  });
}

/** Wait until every outstanding background reindex has settled. */
export async function drainBacklinksReindex(): Promise<void> {
  while (inFlight.size > 0) {
    await Promise.allSettled([...inFlight.values()]);
  }
}
