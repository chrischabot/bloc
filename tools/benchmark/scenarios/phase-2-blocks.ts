import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, hostname, totalmem } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootTestHarness } from '@bloc/api/test-helpers';
import { LATEST_VERSION } from '@bloc/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const REPORT_DIR = join(REPO_ROOT, 'benchmarks', 'reports');

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
}

async function main(): Promise<void> {
  const h = await bootTestHarness();
  const headers = {
    authorization: h.bearer,
    'notion-version': LATEST_VERSION,
    'content-type': 'application/json',
  };
  const body = JSON.stringify({
    children: Array.from({ length: 100 }, (_, i) => ({
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: `b${i}`, link: null } }],
        color: 'default',
      },
    })),
  });

  // Warm-up.
  for (let i = 0; i < 5; i++) {
    await h.app.request(`http://t/v1/blocks/${h.page.id}/children`, {
      method: 'PATCH',
      headers,
      body,
    });
  }

  const samples: number[] = [];
  const iters = 50;
  for (let i = 0; i < iters; i++) {
    const t = performance.now();
    const res = await h.app.request(`http://t/v1/blocks/${h.page.id}/children`, {
      method: 'PATCH',
      headers,
      body,
    });
    if (res.status !== 200) throw new Error(`status=${res.status}`);
    samples.push(performance.now() - t);
  }
  samples.sort((a, b) => a - b);

  const report = {
    label: 'phase-2.blocks.children.append-100',
    ts: new Date().toISOString(),
    iters: samples.length,
    p50_ms: +percentile(samples, 50).toFixed(3),
    p90_ms: +percentile(samples, 90).toFixed(3),
    p99_ms: +percentile(samples, 99).toFixed(3),
    max_ms: +(samples[samples.length - 1] ?? 0).toFixed(3),
    errors: 0,
    budget_p99_ms: 250,
    passed: percentile(samples, 99) < 250,
    host: {
      hostname: hostname(),
      cpu_model: cpus()[0]?.model ?? 'unknown',
      cpu_count: cpus().length,
      ram_gb: Math.round(totalmem() / 1024 ** 3),
      node: process.version,
    },
  };

  mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  writeFileSync(join(REPORT_DIR, `phase-2-${stamp}.json`), JSON.stringify(report, null, 2));
  console.log(
    `[bench-phase-2] p50=${report.p50_ms}ms p90=${report.p90_ms}ms p99=${report.p99_ms}ms passed=${report.passed}`,
  );

  // Wait for every outstanding webhook dispatch + backlinks reindex to settle
  // before PGlite teardown so async tasks don't outlive the DB handle.
  await h.emit.drain();
  const { drainBacklinksReindex } = await import('../../../apps/api/src/backlinks/reindex.ts');
  await drainBacklinksReindex();
  await h.handle.close();
  if (!report.passed) process.exit(1);
}

void main().catch((err: unknown) => {
  console.error('[bench-phase-2] failed', err);
  process.exit(1);
});
