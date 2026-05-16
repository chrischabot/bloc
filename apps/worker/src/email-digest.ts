import { createLogger } from '@bloc/observability';

const logger = createLogger('notion-worker.email-digest');

interface DueReminder {
  id: string;
  user_id: string;
  due_at: string;
  label: string | null;
}

interface DigestEnv {
  apiBase: string;
  bearer: string;
  pollIntervalMs: number;
  notionVersion: string;
}

function envFromProcess(): DigestEnv {
  return {
    apiBase: process.env['API_BASE'] ?? 'http://localhost:3001',
    bearer: process.env['DIGEST_BEARER'] ?? '',
    pollIntervalMs: Number(process.env['DIGEST_POLL_MS'] ?? 60_000),
    notionVersion: process.env['DIGEST_NOTION_VERSION'] ?? '2026-04-01',
  };
}

function bearerHeader(env: DigestEnv): string {
  return env.bearer.startsWith('Bearer ') ? env.bearer : `Bearer ${env.bearer}`;
}

async function fetchDueReminders(env: DigestEnv): Promise<DueReminder[]> {
  if (env.bearer === '') return [];
  const res = await fetch(`${env.apiBase}/v1/reminders/scan-due`, {
    method: 'POST',
    headers: {
      authorization: bearerHeader(env),
      'notion-version': env.notionVersion,
    },
  });
  if (!res.ok) {
    logger.warn({ status: res.status }, 'scan-due returned non-2xx');
    return [];
  }
  const body = (await res.json()) as { results: DueReminder[] };
  return body.results;
}

async function fireReminder(env: DigestEnv, id: string): Promise<boolean> {
  if (env.bearer === '') return false;
  try {
    const res = await fetch(`${env.apiBase}/v1/reminders/${id}/fire`, {
      method: 'POST',
      headers: {
        authorization: bearerHeader(env),
        'notion-version': env.notionVersion,
      },
    });
    if (!res.ok) {
      logger.warn({ id, status: res.status }, 'fire returned non-2xx');
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ id, err }, 'fire threw');
    return false;
  }
}

function groupByUser(reminders: DueReminder[]): Map<string, DueReminder[]> {
  const byUser = new Map<string, DueReminder[]>();
  for (const r of reminders) {
    const arr = byUser.get(r.user_id) ?? [];
    arr.push(r);
    byUser.set(r.user_id, arr);
  }
  return byUser;
}

interface TickResult {
  scanned: number;
  fired: number;
  failed: number;
  users: number;
}

async function tick(env: DigestEnv): Promise<TickResult> {
  const due = await fetchDueReminders(env);
  if (due.length === 0) return { scanned: 0, fired: 0, failed: 0, users: 0 };
  const byUser = groupByUser(due);
  let fired = 0;
  let failed = 0;
  for (const [userId, reminders] of byUser) {
    logger.info(
      {
        userId,
        reminderCount: reminders.length,
        nextLabel: reminders[0]?.label ?? null,
      },
      'email digest: dispatching for user',
    );
    for (const r of reminders) {
      // Sequential to keep load gentle; the rate limiter still applies.
      const ok = await fireReminder(env, r.id);
      if (ok) fired += 1;
      else failed += 1;
    }
  }
  return { scanned: due.length, fired, failed, users: byUser.size };
}

export async function runEmailDigestWorker(envOverride?: Partial<DigestEnv>): Promise<void> {
  const env = { ...envFromProcess(), ...envOverride };
  logger.info({ apiBase: env.apiBase, pollMs: env.pollIntervalMs }, 'email digest worker started');
  let stopped = false;

  const loop = async (): Promise<void> => {
    while (!stopped) {
      try {
        const result = await tick(env);
        if (result.scanned > 0) {
          logger.info(result, 'email digest tick complete');
        }
      } catch (err) {
        logger.error({ err }, 'email digest tick failed');
      }
      await new Promise((r) => setTimeout(r, env.pollIntervalMs));
    }
  };
  void loop();

  const stop = (): void => {
    stopped = true;
    logger.info('email digest worker stopping');
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}

/** Pure exports for unit testing. */
export { groupByUser, tick };
export type { DigestEnv, DueReminder, TickResult };
