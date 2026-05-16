#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus, hostname, totalmem } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const REPORT_DIR = join(REPO_ROOT, 'benchmarks', 'reports');

const SCENARIOS = [
  {
    phase: 1,
    label: 'phase-1.db.listChildren-100',
    cmd: 'pnpm exec tsx tools/benchmark/scenarios/phase-1-db.ts',
  },
  {
    phase: 2,
    label: 'phase-2.blocks.children.append-100',
    cmd: 'pnpm exec tsx tools/benchmark/scenarios/phase-2-blocks.ts',
  },
  {
    phase: 3,
    label: 'phase-3.pages.create-no-children',
    cmd: 'pnpm exec tsx tools/benchmark/scenarios/phase-3-pages.ts',
  },
  {
    phase: 4,
    label: 'phase-4.databases.query-100rows-2clause',
    cmd: 'pnpm exec tsx tools/benchmark/scenarios/phase-4-databases.ts',
  },
  {
    phase: 5,
    label: 'phase-5.search.empty-query-50pages',
    cmd: 'pnpm exec tsx tools/benchmark/scenarios/phase-5-search.ts',
  },
  {
    phase: 22,
    label: 'phase-22.reminders+versions',
    cmd: 'pnpm exec tsx tools/benchmark/scenarios/phase-22-reminders-versions.ts',
  },
];

const stamp = new Date().toISOString().slice(0, 10);

mkdirSync(REPORT_DIR, { recursive: true });

const results = [];
for (const sc of SCENARIOS) {
  console.log(`[sweep] running phase ${sc.phase}...`);
  try {
    execSync(sc.cmd, { stdio: 'inherit', cwd: REPO_ROOT });
    const path = join(REPORT_DIR, `phase-${sc.phase}-${stamp}.json`);
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, 'utf8'));
      results.push({ phase: sc.phase, ...data });
    }
  } catch (err) {
    console.error(`[sweep] phase ${sc.phase} failed:`, err.message);
    results.push({ phase: sc.phase, label: sc.label, error: err.message });
  }
}

function flatten(r) {
  if (r.error !== undefined) return [{ phase: r.phase, label: r.label, error: r.error }];
  if (Array.isArray(r.scenarios)) {
    return r.scenarios.map((s) => ({ phase: r.phase, ...s }));
  }
  return [r];
}

const flatResults = results.flatMap(flatten);

const aggregate = {
  label: `full-suite-${stamp}`,
  ts: new Date().toISOString(),
  host: {
    hostname: hostname(),
    cpu_model: cpus()[0]?.model ?? 'unknown',
    cpu_count: cpus().length,
    ram_gb: Math.round(totalmem() / 1024 ** 3),
    node: process.version,
  },
  summary: {
    scenarios: flatResults.length,
    passed: flatResults.filter((r) => r.passed === true).length,
    failed: flatResults.filter((r) => r.passed === false).length,
    errored: flatResults.filter((r) => r.error !== undefined).length,
  },
  results: flatResults,
};

const outPath = join(REPORT_DIR, `full-suite-${stamp}.json`);
writeFileSync(outPath, JSON.stringify(aggregate, null, 2));

console.log(`\n[sweep] wrote ${outPath}`);
console.log(`[sweep] passed=${aggregate.summary.passed}/${aggregate.summary.scenarios}`);
for (const r of flatResults) {
  if (r.error !== undefined) {
    console.log(`  ✗ phase ${r.phase} (${r.label ?? '?'}): errored`);
  } else {
    console.log(
      `  ${r.passed ? '✓' : '✗'} phase ${r.phase} ${r.label ?? ''}: p50=${r.p50_ms}ms p99=${r.p99_ms}ms budget=${r.budget_p99_ms}ms`,
    );
  }
}
if (aggregate.summary.failed > 0 || aggregate.summary.errored > 0) {
  process.exit(1);
}
