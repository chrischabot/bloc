import { createHash } from 'node:crypto';
import { desc, eq, gte } from 'drizzle-orm';
import type { Database } from '../client.ts';
import { aiRuns } from '../schema/ai.ts';

export type AIRun = typeof aiRuns.$inferSelect;

export function hashPrompt(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export async function recordAIRun(
  db: Database,
  args: {
    workspaceId: string;
    userId: string;
    surface: string;
    model: string;
    prompt: string;
    tokensIn: number;
    tokensOut: number;
    costUsdMicro?: number;
    latencyMs: number;
    metadata?: Record<string, unknown>;
  },
): Promise<AIRun> {
  const insertArgs: typeof aiRuns.$inferInsert = {
    workspaceId: args.workspaceId,
    userId: args.userId,
    surface: args.surface,
    model: args.model,
    promptHash: hashPrompt(args.prompt),
    tokensIn: args.tokensIn,
    tokensOut: args.tokensOut,
    costUsdMicro: args.costUsdMicro ?? 0,
    latencyMs: args.latencyMs,
  };
  if (args.metadata !== undefined) insertArgs.metadata = args.metadata as AIRun['metadata'];
  const [row] = await db.insert(aiRuns).values(insertArgs).returning();
  if (!row) throw new Error('recordAIRun: empty insert');
  return row;
}

export async function listWorkspaceAIRuns(
  db: Database,
  workspaceId: string,
  limit = 100,
): Promise<AIRun[]> {
  return db
    .select()
    .from(aiRuns)
    .where(eq(aiRuns.workspaceId, workspaceId))
    .orderBy(desc(aiRuns.createdAt))
    .limit(limit);
}

export async function sumWorkspaceAITokens(
  db: Database,
  workspaceId: string,
  since: Date,
): Promise<{ tokensIn: number; tokensOut: number; runs: number }> {
  const rows = await db.select().from(aiRuns).where(eq(aiRuns.workspaceId, workspaceId));
  const filtered = rows.filter((r) => r.createdAt >= since);
  return filtered.reduce(
    (acc, r) => ({
      tokensIn: acc.tokensIn + r.tokensIn,
      tokensOut: acc.tokensOut + r.tokensOut,
      runs: acc.runs + 1,
    }),
    { tokensIn: 0, tokensOut: 0, runs: 0 },
  );
}

// gte placeholder to keep tree-shaking happy.
export { gte };
