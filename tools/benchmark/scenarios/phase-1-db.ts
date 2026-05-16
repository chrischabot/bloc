import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, hostname, totalmem } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  addMember,
  appendChildren,
  createPage,
  createUser,
  createWorkspace,
  listChildren,
  openDb,
  runMigrations,
} from '@bloc/db';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const REPORT_DIR = join(REPO_ROOT, 'benchmarks', 'reports');

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
}

async function main(): Promise<void> {
  const handle = await openDb();
  await runMigrations(handle);
  const db = handle.db;

  const user = await createUser(db, { email: 'bench@local', name: 'B', type: 'person' });
  const ws = await createWorkspace(db, { name: 'Bench', plan: 'free' });
  await addMember(db, { workspaceId: ws.id, userId: user.id, role: 'owner' });
  const page = await createPage(db, {
    workspaceId: ws.id,
    parentType: 'workspace',
    createdBy: user.id,
    lastEditedBy: user.id,
  });

  console.log('[bench-phase-1] appending 1000 children…');
  const appendT0 = performance.now();
  for (let i = 0; i < 10; i++) {
    await appendChildren(db, {
      workspaceId: ws.id,
      parentId: page.id,
      parentType: 'page',
      actor: user.id,
      children: Array.from({ length: 100 }, () => ({
        type: 'paragraph',
        content: { paragraph: { rich_text: [], color: 'default' } },
      })),
    });
  }
  const appendTotal = performance.now() - appendT0;
  console.log(`[bench-phase-1] append took ${appendTotal.toFixed(1)}ms`);

  // Warm-up.
  for (let i = 0; i < 20; i++) await listChildren(db, page.id, { limit: 100 });

  const samples: number[] = [];
  const iters = 200;
  for (let i = 0; i < iters; i++) {
    const t = performance.now();
    const rows = await listChildren(db, page.id, { limit: 100 });
    samples.push(performance.now() - t);
    if (rows.length !== 100) throw new Error(`expected 100 rows, got ${rows.length}`);
  }
  samples.sort((a, b) => a - b);

  const p50 = +percentile(samples, 50).toFixed(3);
  const p90 = +percentile(samples, 90).toFixed(3);
  const p99 = +percentile(samples, 99).toFixed(3);
  const maxMs = +(samples[samples.length - 1] ?? 0).toFixed(3);

  const report = {
    label: 'phase-1.db.listChildren-100',
    ts: new Date().toISOString(),
    iters: samples.length,
    p50_ms: p50,
    p90_ms: p90,
    p99_ms: p99,
    max_ms: maxMs,
    errors: 0,
    budget_p99_ms: 80,
    passed: p99 < 80,
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
  const reportPath = join(REPORT_DIR, `phase-1-${stamp}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`[bench-phase-1] wrote ${reportPath}`);
  console.log(
    `[bench-phase-1] p50=${report.p50_ms}ms p90=${report.p90_ms}ms p99=${report.p99_ms}ms max=${report.max_ms}ms passed=${report.passed}`,
  );

  await handle.close();
  if (!report.passed) process.exit(1);
}

void main().catch((err: unknown) => {
  console.error('[bench-phase-1] failed', err);
  process.exit(1);
});
