import { and, asc, eq, gt, inArray } from 'drizzle-orm';
import type { Database } from '../client.ts';
import { between, generateBetween } from '../fractional-index.ts';
import { blocks } from '../schema/blocks.ts';

export type Block = typeof blocks.$inferSelect;
export type NewBlock = typeof blocks.$inferInsert;

export interface AppendChildrenArgs {
  parentId: string;
  parentType: 'page' | 'block' | 'database';
  workspaceId: string;
  actor: string;
  /** Optional: insert after this sibling id (otherwise append to end). */
  afterId?: string;
  /** New children, each with type + content. */
  children: { type: string; content?: unknown }[];
}

export async function appendChildren(db: Database, args: AppendChildrenArgs): Promise<Block[]> {
  if (args.children.length === 0) return [];

  // Resolve the position window: from `afterId` (or null = start) to the next sibling's position.
  const siblings = await db
    .select({ id: blocks.id, position: blocks.position })
    .from(blocks)
    .where(and(eq(blocks.parentId, args.parentId), eq(blocks.archived, false)))
    .orderBy(asc(blocks.position));

  let beforePos: string | null;
  let afterPos: string | null;

  if (args.afterId !== undefined) {
    const afterIdx = siblings.findIndex((s) => s.id === args.afterId);
    if (afterIdx < 0) {
      throw new Error(`appendChildren: after sibling ${args.afterId} not found`);
    }
    const afterSibling = siblings[afterIdx];
    if (afterSibling === undefined) {
      throw new Error(`appendChildren: after sibling index ${afterIdx} unreachable`);
    }
    beforePos = afterSibling.position;
    afterPos = siblings[afterIdx + 1]?.position ?? null;
  } else {
    // Append to the end.
    const last = siblings.at(-1);
    beforePos = last?.position ?? null;
    afterPos = null;
  }

  const positions = generateBetween(beforePos, afterPos, args.children.length);
  const rows: NewBlock[] = args.children.map((child, i) => {
    const pos = positions[i];
    if (pos === undefined) {
      throw new Error(`appendChildren: missing position for child index ${i}`);
    }
    return {
      workspaceId: args.workspaceId,
      parentType: args.parentType,
      parentId: args.parentId,
      position: pos,
      type: child.type,
      content: (child.content ?? {}) as Block['content'],
      createdBy: args.actor,
      lastEditedBy: args.actor,
    };
  });

  const inserted = await db.insert(blocks).values(rows).returning();

  // Maintain has_children on the parent if it's a block.
  if (args.parentType === 'block') {
    await db.update(blocks).set({ hasChildren: true }).where(eq(blocks.id, args.parentId));
  }
  return inserted;
}

export async function getBlock(db: Database, id: string): Promise<Block | null> {
  const [row] = await db.select().from(blocks).where(eq(blocks.id, id)).limit(1);
  return row ?? null;
}

export async function listChildren(
  db: Database,
  parentId: string,
  opts?: { startPosition?: string; limit?: number; includeArchived?: boolean },
): Promise<Block[]> {
  const conditions = [eq(blocks.parentId, parentId)];
  if (!(opts?.includeArchived ?? false)) conditions.push(eq(blocks.archived, false));
  if (opts?.startPosition !== undefined) {
    conditions.push(gt(blocks.position, opts.startPosition));
  }
  return db
    .select()
    .from(blocks)
    .where(and(...conditions))
    .orderBy(asc(blocks.position))
    .limit(opts?.limit ?? 100);
}

export async function updateBlock(
  db: Database,
  id: string,
  patch: { content?: unknown; archived?: boolean; actor: string },
): Promise<Block | null> {
  const update: Partial<NewBlock> = {
    lastEditedBy: patch.actor,
    lastEditedAt: new Date(),
  };
  if (patch.content !== undefined) update.content = patch.content as Block['content'];
  if (patch.archived !== undefined) update.archived = patch.archived;
  // Bump version for v3 conflict resolution.
  const [current] = await db
    .select({ version: blocks.version })
    .from(blocks)
    .where(eq(blocks.id, id))
    .limit(1);
  if (current) update.version = current.version + 1;
  const [row] = await db.update(blocks).set(update).where(eq(blocks.id, id)).returning();
  return row ?? null;
}

export async function archiveBlock(db: Database, id: string, actor: string): Promise<Block | null> {
  return updateBlock(db, id, { archived: true, actor });
}

/** Walk the subtree rooted at `rootId` and collect every block id. */
export async function collectSubtreeIds(db: Database, rootId: string): Promise<string[]> {
  const out: string[] = [];
  let frontier: string[] = [rootId];
  while (frontier.length > 0) {
    const rows = await db
      .select({ id: blocks.id })
      .from(blocks)
      .where(inArray(blocks.parentId, frontier));
    const nextIds = rows.map((r) => r.id);
    out.push(...nextIds);
    frontier = nextIds;
  }
  return out;
}

export { between };
