import { and, eq } from 'drizzle-orm';
import type { Database } from '../client.ts';
import { pageProperties } from '../schema/properties.ts';

export type PagePropertyRow = typeof pageProperties.$inferSelect;
export type NewPageProperty = typeof pageProperties.$inferInsert;

export interface PropertyValue {
  type: string;
  [key: string]: unknown;
}

export async function setPageProperty(
  db: Database,
  args: { pageId: string; propertyId: string; value: PropertyValue },
): Promise<void> {
  await db
    .insert(pageProperties)
    .values({ pageId: args.pageId, propertyId: args.propertyId, value: args.value })
    .onConflictDoUpdate({
      target: [pageProperties.pageId, pageProperties.propertyId],
      set: { value: args.value },
    });
}

export async function getPageProperty(
  db: Database,
  args: { pageId: string; propertyId: string },
): Promise<PagePropertyRow | null> {
  const [row] = await db
    .select()
    .from(pageProperties)
    .where(
      and(eq(pageProperties.pageId, args.pageId), eq(pageProperties.propertyId, args.propertyId)),
    )
    .limit(1);
  return row ?? null;
}

export async function listPageProperties(db: Database, pageId: string): Promise<PagePropertyRow[]> {
  return db.select().from(pageProperties).where(eq(pageProperties.pageId, pageId));
}
