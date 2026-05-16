import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { Database } from '../client.ts';
import { customDomains, publications } from '../schema/sites.ts';

export type Publication = typeof publications.$inferSelect;
export type CustomDomain = typeof customDomains.$inferSelect;

/** Generate a stable slug from a page title with a short hash suffix. */
export function generateSlug(title: string): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'untitled';
  const hash = randomBytes(8).toString('hex').slice(0, 8);
  return `${base}-${hash}`;
}

export async function upsertPublication(
  db: Database,
  args: {
    pageId: string;
    state?: 'draft' | 'live' | 'expired';
    slug: string;
    customDomainId?: string | null;
    allowEdit?: boolean;
    allowComment?: boolean;
    allowDuplicate?: boolean;
    indexInSearch?: boolean;
    showToc?: boolean;
    showNavbar?: boolean;
    expiresAt?: Date | null;
    createdBy: string;
  },
): Promise<Publication> {
  const [existing] = await db
    .select()
    .from(publications)
    .where(eq(publications.pageId, args.pageId))
    .limit(1);
  if (existing !== undefined) {
    const update: Partial<typeof publications.$inferInsert> = { updatedAt: new Date() };
    if (args.state !== undefined) update.state = args.state;
    update.slug = args.slug;
    if (args.customDomainId !== undefined) {
      update.customDomainId = args.customDomainId;
    }
    if (args.allowEdit !== undefined) update.allowEdit = args.allowEdit;
    if (args.allowComment !== undefined) update.allowComment = args.allowComment;
    if (args.allowDuplicate !== undefined) update.allowDuplicate = args.allowDuplicate;
    if (args.indexInSearch !== undefined) update.indexInSearch = args.indexInSearch;
    if (args.showToc !== undefined) update.showToc = args.showToc;
    if (args.showNavbar !== undefined) update.showNavbar = args.showNavbar;
    if (args.expiresAt !== undefined) update.expiresAt = args.expiresAt;
    const [updated] = await db
      .update(publications)
      .set(update)
      .where(eq(publications.id, existing.id))
      .returning();
    if (!updated) throw new Error('upsertPublication: update returned no row');
    return updated;
  }
  const insertArgs: typeof publications.$inferInsert = {
    pageId: args.pageId,
    slug: args.slug,
    createdBy: args.createdBy,
    state: args.state ?? 'live',
  };
  if (args.customDomainId !== undefined && args.customDomainId !== null) {
    insertArgs.customDomainId = args.customDomainId;
  }
  if (args.allowEdit !== undefined) insertArgs.allowEdit = args.allowEdit;
  if (args.allowComment !== undefined) insertArgs.allowComment = args.allowComment;
  if (args.allowDuplicate !== undefined) insertArgs.allowDuplicate = args.allowDuplicate;
  if (args.indexInSearch !== undefined) insertArgs.indexInSearch = args.indexInSearch;
  if (args.showToc !== undefined) insertArgs.showToc = args.showToc;
  if (args.showNavbar !== undefined) insertArgs.showNavbar = args.showNavbar;
  if (args.expiresAt !== undefined && args.expiresAt !== null) {
    insertArgs.expiresAt = args.expiresAt;
  }
  const [row] = await db.insert(publications).values(insertArgs).returning();
  if (!row) throw new Error('upsertPublication: empty insert');
  return row;
}

export async function getPublicationByPage(
  db: Database,
  pageId: string,
): Promise<Publication | null> {
  const [row] = await db
    .select()
    .from(publications)
    .where(eq(publications.pageId, pageId))
    .limit(1);
  return row ?? null;
}

export async function getPublicationBySlug(
  db: Database,
  slug: string,
): Promise<Publication | null> {
  const [row] = await db.select().from(publications).where(eq(publications.slug, slug)).limit(1);
  return row ?? null;
}

export async function unpublish(db: Database, pageId: string): Promise<boolean> {
  const result = await db.delete(publications).where(eq(publications.pageId, pageId)).returning();
  return result.length > 0;
}

// Custom domains

export async function createCustomDomain(
  db: Database,
  args: { workspaceId: string; domain: string; dnsRecords?: unknown[] },
): Promise<CustomDomain> {
  const dnsRecords = args.dnsRecords ?? [
    { type: 'CNAME', name: '@', value: 'sites.bloc.local' },
    { type: 'TXT', name: '_notion-verify', value: randomBytes(16).toString('hex') },
  ];
  const [row] = await db
    .insert(customDomains)
    .values({
      workspaceId: args.workspaceId,
      domain: args.domain,
      dnsRecords: dnsRecords as CustomDomain['dnsRecords'],
    })
    .returning();
  if (!row) throw new Error('createCustomDomain: empty insert');
  return row;
}

export async function listCustomDomains(
  db: Database,
  workspaceId: string,
): Promise<CustomDomain[]> {
  return db.select().from(customDomains).where(eq(customDomains.workspaceId, workspaceId));
}

export async function getCustomDomain(db: Database, id: string): Promise<CustomDomain | null> {
  const [row] = await db.select().from(customDomains).where(eq(customDomains.id, id)).limit(1);
  return row ?? null;
}

export async function updateCustomDomainStatus(
  db: Database,
  args: { id: string; workspaceId: string; status: 'pending' | 'provisioning' | 'live' | 'failed' },
): Promise<CustomDomain | null> {
  const [row] = await db
    .update(customDomains)
    .set({ status: args.status, updatedAt: new Date() })
    .where(and(eq(customDomains.id, args.id), eq(customDomains.workspaceId, args.workspaceId)))
    .returning();
  return row ?? null;
}

export async function deleteCustomDomain(
  db: Database,
  args: { id: string; workspaceId: string },
): Promise<boolean> {
  const result = await db
    .delete(customDomains)
    .where(and(eq(customDomains.id, args.id), eq(customDomains.workspaceId, args.workspaceId)))
    .returning();
  return result.length > 0;
}
