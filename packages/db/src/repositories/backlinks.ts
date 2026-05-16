import { and, eq, inArray } from 'drizzle-orm';
import type { Database } from '../client.ts';
import { backlinks } from '../schema/backlinks.ts';
import { blocks } from '../schema/blocks.ts';
import { pages } from '../schema/pages.ts';
import { pageProperties } from '../schema/properties.ts';

export type Backlink = typeof backlinks.$inferSelect;

export interface BacklinkInput {
  sourcePageId: string;
  targetPageId: string;
  sourceBlockId: string | null;
  kind: 'mention' | 'link_to_page' | 'relation';
  snippet?: string | null;
}

export async function upsertBacklinks(db: Database, rows: BacklinkInput[]): Promise<void> {
  if (rows.length === 0) return;
  for (const r of rows) {
    const insertArgs: typeof backlinks.$inferInsert = {
      sourcePageId: r.sourcePageId,
      targetPageId: r.targetPageId,
      kind: r.kind,
    };
    if (r.sourceBlockId !== null) insertArgs.sourceBlockId = r.sourceBlockId;
    if (r.snippet !== undefined && r.snippet !== null) insertArgs.snippet = r.snippet;
    try {
      await db.insert(backlinks).values(insertArgs);
    } catch {
      // Ignore unique-violation duplicates.
    }
  }
}

/** Remove every backlink whose source is the given page. */
export async function clearBacklinksForSource(db: Database, sourcePageId: string): Promise<void> {
  await db.delete(backlinks).where(eq(backlinks.sourcePageId, sourcePageId));
}

/** Get inbound backlinks for a target page. */
export async function listBacklinksForTarget(
  db: Database,
  targetPageId: string,
  limit = 100,
): Promise<Backlink[]> {
  return db.select().from(backlinks).where(eq(backlinks.targetPageId, targetPageId)).limit(limit);
}

/**
 * Walk every block under a page subtree AND, for database-row pages, every
 * property value on the row, extracting page references and (re)materialising
 * backlinks. Replaces any prior backlinks rooted at the source page.
 */
export async function reindexBacklinksForPage(db: Database, sourcePageId: string): Promise<number> {
  await clearBacklinksForSource(db, sourcePageId);
  const seen = new Set<string>();
  const inputs: BacklinkInput[] = [];

  // 1) Walk the block subtree rooted at the page.
  const rows = await collectBlockSubtree(db, sourcePageId);
  for (const row of rows) {
    for (const ref of extractRefs(row.content as Record<string, unknown>, row.type)) {
      if (ref.targetPageId === sourcePageId) continue;
      const key = `${ref.targetPageId}|${ref.kind}|${row.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      inputs.push({
        sourcePageId,
        targetPageId: ref.targetPageId,
        sourceBlockId: row.id,
        kind: ref.kind,
        snippet: ref.snippet ?? null,
      });
    }
  }

  // 2) For database-row pages, walk page_properties.value for mention / relation refs.
  const [pageRow] = await db.select().from(pages).where(eq(pages.id, sourcePageId)).limit(1);
  if (pageRow !== undefined && pageRow.parentType === 'database') {
    const propRows = await db
      .select()
      .from(pageProperties)
      .where(eq(pageProperties.pageId, sourcePageId));
    for (const prop of propRows) {
      for (const ref of extractRefs(prop.value as Record<string, unknown>, 'property')) {
        if (ref.targetPageId === sourcePageId) continue;
        const key = `${ref.targetPageId}|${ref.kind}|property`;
        if (seen.has(key)) continue;
        seen.add(key);
        inputs.push({
          sourcePageId,
          targetPageId: ref.targetPageId,
          sourceBlockId: null,
          kind: ref.kind,
          snippet: ref.snippet ?? null,
        });
      }
    }
  }

  await upsertBacklinks(db, inputs);
  return inputs.length;
}

interface PageRef {
  targetPageId: string;
  kind: 'mention' | 'link_to_page' | 'relation';
  snippet?: string | null;
}

function extractRefs(content: Record<string, unknown>, type: string): PageRef[] {
  const refs: PageRef[] = [];
  // Top-level link_to_page block.
  if (type === 'link_to_page') {
    const payload = (content['link_to_page'] ?? content) as Record<string, unknown>;
    if (typeof payload['page_id'] === 'string') {
      refs.push({ targetPageId: payload['page_id'], kind: 'link_to_page' });
    }
  }

  // Relation property value: `{ type: 'relation', relation: [{ id: '<page-id>' }, ...] }`.
  if (
    type === 'property' &&
    typeof content['type'] === 'string' &&
    content['type'] === 'relation'
  ) {
    const arr = content['relation'];
    if (Array.isArray(arr)) {
      for (const entry of arr as Array<{ id?: string }>) {
        if (typeof entry?.id === 'string') {
          refs.push({ targetPageId: entry.id, kind: 'relation' });
        }
      }
    }
  }

  // Rich-text mention payload, recursively scan.
  const richTextArrays: unknown[] = [];
  function collect(obj: unknown): void {
    if (obj === null || typeof obj !== 'object') return;
    const o = obj as Record<string, unknown>;
    if (Array.isArray(o['rich_text'])) richTextArrays.push(o['rich_text']);
    if (Array.isArray(o['caption'])) richTextArrays.push(o['caption']);
    if (Array.isArray(o['title'])) richTextArrays.push(o['title']);
    for (const v of Object.values(o)) collect(v);
  }
  collect(content);
  for (const arr of richTextArrays) {
    if (!Array.isArray(arr)) continue;
    for (const node of arr) {
      if (node === null || typeof node !== 'object') continue;
      const n = node as Record<string, unknown>;
      if (n['type'] === 'mention') {
        const mention = n['mention'] as Record<string, unknown> | undefined;
        if (mention && mention['type'] === 'page') {
          const target = (mention['page'] as { id?: string } | undefined)?.id;
          if (typeof target === 'string') {
            refs.push({
              targetPageId: target,
              kind: 'mention',
              snippet:
                typeof n['plain_text'] === 'string'
                  ? (n['plain_text'] as string).slice(0, 200)
                  : null,
            });
          }
        }
      }
    }
  }
  return refs;
}

async function collectBlockSubtree(
  db: Database,
  sourcePageId: string,
): Promise<{ id: string; type: string; content: unknown }[]> {
  const out: { id: string; type: string; content: unknown }[] = [];
  let frontier: string[] = [sourcePageId];
  while (frontier.length > 0) {
    const rows = await db
      .select({ id: blocks.id, type: blocks.type, content: blocks.content })
      .from(blocks)
      .where(and(inArray(blocks.parentId, frontier), eq(blocks.archived, false)));
    out.push(...rows);
    frontier = rows.map((r) => r.id);
  }
  return out;
}
