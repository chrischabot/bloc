import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, hostname, totalmem } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootTestHarness } from '@bloc/api/test-helpers';
import { schema } from '@bloc/db';
import { LATEST_VERSION } from '@bloc/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const REPORT_DIR = join(REPO_ROOT, 'benchmarks', 'reports');

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
}

async function timeAction<T>(fn: () => Promise<T>): Promise<number> {
  const t0 = performance.now();
  await fn();
  return performance.now() - t0;
}

async function main(): Promise<void> {
  const h = await bootTestHarness();
  let failed = 0;
  try {
    const headers = {
      authorization: h.bearer,
      'notion-version': LATEST_VERSION,
      'content-type': 'application/json',
    };

    // Pre-seed 50 reminders + 50 block_updates so list endpoints have meaningful work.
    for (let i = 0; i < 50; i++) {
      await h.app.request('http://t/v1/reminders', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          parent: { type: 'page', id: h.page.id },
          due_at: new Date(Date.now() + i * 60_000).toISOString(),
          label: `seed-${i}`,
        }),
      });
    }
    for (let i = 1; i <= 50; i++) {
      await h.handle.db.insert(schema.blockUpdates).values({
        pageId: h.page.id,
        clock: i,
        update: new Uint8Array([1, 2, 3, 4]),
      });
    }

    // Warm-up.
    for (let i = 0; i < 5; i++) {
      await h.app.request('http://t/v1/reminders?include_fired=true', { headers });
      await h.app.request(`http://t/v1/pages/${h.page.id}/versions`, { headers });
    }

    // reminders.list
    const remindersListSamples: number[] = [];
    for (let i = 0; i < 50; i++) {
      remindersListSamples.push(
        await timeAction(async () => {
          const res = await h.app.request('http://t/v1/reminders?include_fired=true', { headers });
          if (res.status !== 200) throw new Error(`status=${res.status}`);
        }),
      );
    }
    remindersListSamples.sort((a, b) => a - b);

    // reminders.create
    const remindersCreateSamples: number[] = [];
    const createBody = JSON.stringify({
      parent: { type: 'page', id: h.page.id },
      due_at: new Date(Date.now() + 60 * 60_000).toISOString(),
      label: 'benchmark',
    });
    for (let i = 0; i < 50; i++) {
      remindersCreateSamples.push(
        await timeAction(async () => {
          const res = await h.app.request('http://t/v1/reminders', {
            method: 'POST',
            headers,
            body: createBody,
          });
          if (res.status !== 200) throw new Error(`status=${res.status}`);
        }),
      );
    }
    remindersCreateSamples.sort((a, b) => a - b);

    // versions.list
    const versionsListSamples: number[] = [];
    for (let i = 0; i < 50; i++) {
      versionsListSamples.push(
        await timeAction(async () => {
          const res = await h.app.request(`http://t/v1/pages/${h.page.id}/versions?page_size=25`, {
            headers,
          });
          if (res.status !== 200) throw new Error(`status=${res.status}`);
        }),
      );
    }
    versionsListSamples.sort((a, b) => a - b);

    const report = {
      label: 'phase-22.reminders+versions',
      ts: new Date().toISOString(),
      host: {
        hostname: hostname(),
        cpu_model: cpus()[0]?.model ?? 'unknown',
        cpu_count: cpus().length,
        ram_gb: Math.round(totalmem() / 1024 ** 3),
        node: process.version,
      },
      scenarios: [
        {
          label: 'reminders.list-50',
          iters: remindersListSamples.length,
          p50_ms: +percentile(remindersListSamples, 50).toFixed(3),
          p99_ms: +percentile(remindersListSamples, 99).toFixed(3),
          budget_p99_ms: 150,
          passed: percentile(remindersListSamples, 99) < 150,
        },
        {
          label: 'reminders.create',
          iters: remindersCreateSamples.length,
          p50_ms: +percentile(remindersCreateSamples, 50).toFixed(3),
          p99_ms: +percentile(remindersCreateSamples, 99).toFixed(3),
          budget_p99_ms: 150,
          passed: percentile(remindersCreateSamples, 99) < 150,
        },
        {
          label: 'versions.list-25',
          iters: versionsListSamples.length,
          p50_ms: +percentile(versionsListSamples, 50).toFixed(3),
          p99_ms: +percentile(versionsListSamples, 99).toFixed(3),
          budget_p99_ms: 150,
          passed: percentile(versionsListSamples, 99) < 150,
        },
      ],
    };

    mkdirSync(REPORT_DIR, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10);
    const outPath = join(REPORT_DIR, `phase-22-${stamp}.json`);
    writeFileSync(outPath, JSON.stringify(report, null, 2));

    console.log(`[bench-phase-22] wrote ${outPath}`);
    for (const sc of report.scenarios) {
      console.log(
        `  ${sc.passed ? '✓' : '✗'} ${sc.label}: p50=${sc.p50_ms}ms p99=${sc.p99_ms}ms budget=${sc.budget_p99_ms}ms`,
      );
    }
    failed = report.scenarios.filter((s) => !s.passed).length;
  } finally {
    try {
      await h.handle.close();
    } catch {
      // Ignore close errors during teardown.
    }
  }
  if (failed > 0) process.exit(1);
}

void main().catch((err: unknown) => {
  console.error('[bench-phase-22] failed', err);
  process.exit(1);
});
