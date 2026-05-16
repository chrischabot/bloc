import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../client.ts';
import { blocks } from '../schema/blocks.ts';
import { pages } from '../schema/pages.ts';

export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;

export async function createPage(db: Database, input: NewPage): Promise<Page> {
  const [row] = await db.insert(pages).values(input).returning();
  if (!row) throw new Error('createPage: empty insert result');
  return row;
}

export async function getPage(db: Database, id: string): Promise<Page | null> {
  const [row] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
  return row ?? null;
}

export async function updatePage(
  db: Database,
  id: string,
  patch: Partial<NewPage>,
): Promise<Page | null> {
  const [row] = await db
    .update(pages)
    .set({ ...patch, lastEditedAt: new Date() })
    .where(eq(pages.id, id))
    .returning();
  return row ?? null;
}

export async function archivePage(db: Database, id: string, actor: string): Promise<void> {
  // Soft-archive the page and all blocks belonging to it (recursively).
  await db
    .update(pages)
    .set({ archived: true, inTrash: true, lastEditedBy: actor, lastEditedAt: new Date() })
    .where(eq(pages.id, id));
  // Archive every block under this page (top-level + descendants).
  await db
    .update(blocks)
    .set({ archived: true, lastEditedBy: actor })
    .where(and(eq(blocks.parentType, 'page'), eq(blocks.parentId, id)));
}

export async function listPagesByParent(
  db: Database,
  parentId: string,
  opts?: { archived?: boolean },
): Promise<Page[]> {
  const archived = opts?.archived ?? false;
  return db
    .select()
    .from(pages)
    .where(and(eq(pages.parentId, parentId), eq(pages.archived, archived)))
    .orderBy(pages.lastEditedAt);
}

export async function listPagesByDataSource(
  db: Database,
  dataSourceId: string,
  opts?: { archived?: boolean },
): Promise<Page[]> {
  const archived = opts?.archived ?? false;
  return db
    .select()
    .from(pages)
    .where(and(eq(pages.dataSourceId, dataSourceId), eq(pages.archived, archived)));
}

/** Bump last_edited_at + last_edited_by on a set of page ids (after block mutations). */
export async function touchPages(db: Database, pageIds: string[], actor: string): Promise<void> {
  if (pageIds.length === 0) return;
  await db
    .update(pages)
    .set({ lastEditedAt: new Date(), lastEditedBy: actor })
    .where(inArray(pages.id, pageIds));
}

/** Detect a parent cycle (a → b → ... → a). */
export async function detectParentCycle(
  db: Database,
  pageId: string,
  candidateParentId: string,
): Promise<boolean> {
  if (pageId === candidateParentId) return true;
  let current: string | null = candidateParentId;
  const seen = new Set<string>();
  while (current !== null && !seen.has(current)) {
    seen.add(current);
    const [parent] = await db
      .select({ parentId: pages.parentId, parentType: pages.parentType })
      .from(pages)
      .where(eq(pages.id, current))
      .limit(1);
    if (!parent) return false;
    if (parent.parentType !== 'page') return false;
    if (parent.parentId === pageId) return true;
    current = parent.parentId ?? null;
  }
  return false;
}

export async function permanentDeletePage(db: Database, id: string): Promise<boolean> {
  const result = await db.delete(pages).where(eq(pages.id, id)).returning();
  return result.length > 0;
}

export const PAGES_ORDER_BY_LAST_EDITED = sql`${pages.lastEditedAt} DESC`;
