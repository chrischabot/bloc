import { and, asc, eq } from 'drizzle-orm';
import type { Database } from '../client.ts';
import { between } from '../fractional-index.ts';
import { dataSources, databaseProperties, databaseViews, databases } from '../schema/pages.ts';

export type DatabaseRow = typeof databases.$inferSelect;
export type NewDatabaseRow = typeof databases.$inferInsert;
export type DataSource = typeof dataSources.$inferSelect;
export type DatabaseProperty = typeof databaseProperties.$inferSelect;
export type DatabaseView = typeof databaseViews.$inferSelect;

export async function createDatabase(db: Database, input: NewDatabaseRow): Promise<DatabaseRow> {
  const [row] = await db.insert(databases).values(input).returning();
  if (!row) throw new Error('createDatabase: empty insert');
  // Auto-create a default data source for new databases.
  await db.insert(dataSources).values({
    databaseId: row.id,
    name: 'Default',
    type: 'owned',
    position: between(null, null),
  });
  return row;
}

export async function getDatabase(db: Database, id: string): Promise<DatabaseRow | null> {
  const [row] = await db.select().from(databases).where(eq(databases.id, id)).limit(1);
  return row ?? null;
}

export async function listDataSources(db: Database, databaseId: string): Promise<DataSource[]> {
  return db
    .select()
    .from(dataSources)
    .where(and(eq(dataSources.databaseId, databaseId), eq(dataSources.archived, false)))
    .orderBy(asc(dataSources.position));
}

export async function getDefaultDataSource(
  db: Database,
  databaseId: string,
): Promise<DataSource | null> {
  const all = await listDataSources(db, databaseId);
  return all[0] ?? null;
}

export async function createProperty(
  db: Database,
  args: {
    databaseId: string;
    dataSourceId?: string;
    name: string;
    type: string;
    config?: unknown;
  },
): Promise<DatabaseProperty> {
  // Compute position after the last existing property.
  const existing = await db
    .select({ position: databaseProperties.position })
    .from(databaseProperties)
    .where(eq(databaseProperties.databaseId, args.databaseId))
    .orderBy(asc(databaseProperties.position));
  const lastPos = existing.at(-1)?.position ?? null;
  const position = between(lastPos, null);
  const insertArgs: typeof databaseProperties.$inferInsert = {
    databaseId: args.databaseId,
    name: args.name,
    type: args.type,
    config: (args.config ?? {}) as DatabaseProperty['config'],
    position,
  };
  if (args.dataSourceId !== undefined) insertArgs.dataSourceId = args.dataSourceId;
  const [row] = await db.insert(databaseProperties).values(insertArgs).returning();
  if (!row) throw new Error('createProperty: empty insert');
  return row;
}

export async function listProperties(
  db: Database,
  databaseId: string,
): Promise<DatabaseProperty[]> {
  return db
    .select()
    .from(databaseProperties)
    .where(eq(databaseProperties.databaseId, databaseId))
    .orderBy(asc(databaseProperties.position));
}

export async function createView(
  db: Database,
  input: typeof databaseViews.$inferInsert,
): Promise<DatabaseView> {
  const [row] = await db.insert(databaseViews).values(input).returning();
  if (!row) throw new Error('createView: empty insert');
  return row;
}

export async function listViews(db: Database, databaseId: string): Promise<DatabaseView[]> {
  return db
    .select()
    .from(databaseViews)
    .where(eq(databaseViews.databaseId, databaseId))
    .orderBy(asc(databaseViews.position));
}
