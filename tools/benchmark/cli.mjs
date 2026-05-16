#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, hostname, totalmem } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const REPORT_DIR = join(REPO_ROOT, 'benchmarks', 'reports');

const args = process.argv.slice(2);
const smoke = args.includes('--smoke');
const reportArgIdx = args.indexOf('--report');
const reportArg = reportArgIdx >= 0 ? args[reportArgIdx + 1] : null;

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function runInProcessBench(label, iters) {
  const samples = [];
  // Warm-up
  for (let i = 0; i < 50; i++) {
    JSON.parse(JSON.stringify({ i, payload: 'warmup' }));
  }
  for (let i = 0; i < iters; i++) {
    const start = performance.now();
    JSON.parse(JSON.stringify({ i, payload: 'hello', list: [1, 2, 3, 4, 5] }));
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return {
    label,
    ts: new Date().toISOString(),
    iters: samples.length,
    p50_ms: +percentile(samples, 50).toFixed(3),
    p90_ms: +percentile(samples, 90).toFixed(3),
    p99_ms: +percentile(samples, 99).toFixed(3),
    max_ms: +samples[samples.length - 1].toFixed(3),
    errors: 0,
    host: {
      hostname: hostname(),
      cpu_model: cpus()[0]?.model ?? 'unknown',
      cpu_count: cpus().length,
      ram_gb: Math.round(totalmem() / 1024 ** 3),
      node: process.version,
    },
  };
}

async function main() {
  const iters = smoke ? 1_000 : 50_000;
  console.log(`[bench] mode=${smoke ? 'smoke' : 'full'} iters=${iters}`);

  const report = await runInProcessBench('phase-0.in-process.json-roundtrip', iters);
  const stamp = new Date().toISOString().slice(0, 10);
  mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = reportArg ? resolve(reportArg) : join(REPORT_DIR, `phase-0-${stamp}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`[bench] wrote ${reportPath}`);
  console.log(
    `[bench] p50=${report.p50_ms}ms p90=${report.p90_ms}ms p99=${report.p99_ms}ms max=${report.max_ms}ms`,
  );
}

main().catch((err) => {
  console.error('[bench] failed', err);
  process.exit(1);
});
