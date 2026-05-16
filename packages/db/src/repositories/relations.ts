// Public API contract:
//   syncDualRelation(db, {
//     sourcePageId: string,
//     sourcePropertyDef: { id: string; type: string; config: Record<string, unknown> | null },
//     oldRefs: string[],
//     newRefs: string[],
//   })
//
// Callers MUST pass `sourcePageId` and the full `sourcePropertyDef` object;
// `pageId` / `propertyId` are NOT accepted by this helper.

import { and, eq } from 'drizzle-orm';
import type { Database } from '../client.ts';
import { databaseProperties } from '../schema/pages.ts';
import { pageProperties } from '../schema/properties.ts';

/** Argument shape for `syncDualRelation`. */
export interface SyncDualRelationArgs {
  /** Page whose relation property was just updated. */
  sourcePageId: string;
  /** The (database) property def whose `config` describes the relation. */
  sourcePropertyDef: {
    id: string;
    type: string;
    config: Record<string, unknown> | null | undefined;
  };
  /** The relation value before the mutation (page refs the source pointed to). */
  oldRefs: string[];
  /** The relation value after the mutation. */
  newRefs: string[];
}

interface RelationConfig {
  database_id?: string;
  type?: string;
  dual_property?: {
    synced_property_id?: string;
    synced_property_name?: string;
  };
}

interface RelationValue {
  type: 'relation';
  relation: Array<{ id: string }>;
  has_more?: boolean;
}

/**
 * Propagate a relation change to the inverse property on a `dual_property`
 * relation. No-op when the source property is `single_property` or when the
 * target property cannot be resolved. Idempotent: re-running with the same
 * refs is a no-op.
 */
export async function syncDualRelation(db: Database, args: SyncDualRelationArgs): Promise<void> {
  if (args.sourcePropertyDef.type !== 'relation') return;
  const config = (args.sourcePropertyDef.config ?? {}) as RelationConfig;
  if (config.type !== 'dual_property') return;
  const syncedId = config.dual_property?.synced_property_id;
  if (typeof syncedId !== 'string' || syncedId.length === 0) return;

  // Resolve the inverse property def to verify it's a relation.
  const [inverseProp] = await db
    .select()
    .from(databaseProperties)
    .where(eq(databaseProperties.id, syncedId))
    .limit(1);
  if (!inverseProp || inverseProp.type !== 'relation') return;

  const added = args.newRefs.filter((id) => !args.oldRefs.includes(id));
  const removed = args.oldRefs.filter((id) => !args.newRefs.includes(id));
  if (added.length === 0 && removed.length === 0) return;

  for (const targetPageId of added) {
    await updateInverseRelation(db, {
      targetPageId,
      inversePropertyId: syncedId,
      sourcePageId: args.sourcePageId,
      mode: 'add',
    });
  }
  for (const targetPageId of removed) {
    await updateInverseRelation(db, {
      targetPageId,
      inversePropertyId: syncedId,
      sourcePageId: args.sourcePageId,
      mode: 'remove',
    });
  }
}

interface InverseUpdate {
  targetPageId: string;
  inversePropertyId: string;
  sourcePageId: string;
  mode: 'add' | 'remove';
}

async function updateInverseRelation(db: Database, args: InverseUpdate): Promise<void> {
  const [row] = await db
    .select()
    .from(pageProperties)
    .where(
      and(
        eq(pageProperties.pageId, args.targetPageId),
        eq(pageProperties.propertyId, args.inversePropertyId),
      ),
    )
    .limit(1);

  const current = (row?.value as RelationValue | undefined) ?? {
    type: 'relation',
    relation: [],
  };
  const currentIds = (current.relation ?? []).map((r) => r.id);

  let nextIds: string[];
  if (args.mode === 'add') {
    if (currentIds.includes(args.sourcePageId)) return; // idempotent
    nextIds = [...currentIds, args.sourcePageId];
  } else {
    if (!currentIds.includes(args.sourcePageId)) return; // idempotent
    nextIds = currentIds.filter((id) => id !== args.sourcePageId);
  }
  const nextValue: RelationValue = {
    type: 'relation',
    relation: nextIds.map((id) => ({ id })),
  };
  if (currentIds.length >= 25 || nextIds.length >= 25) {
    nextValue.has_more = nextIds.length > 25;
  }

  await db
    .insert(pageProperties)
    .values({
      pageId: args.targetPageId,
      propertyId: args.inversePropertyId,
      value: nextValue,
    })
    .onConflictDoUpdate({
      target: [pageProperties.pageId, pageProperties.propertyId],
      set: { value: nextValue },
    });
}

/** Extract the array of page ids referenced by a relation value, if any. */
export function extractRelationRefs(value: unknown): string[] {
  if (value === null || typeof value !== 'object') return [];
  const v = value as Record<string, unknown>;
  if (v['type'] !== 'relation') return [];
  const arr = v['relation'];
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r) => (r !== null && typeof r === 'object' ? (r as { id?: string }).id : undefined))
    .filter((id): id is string => typeof id === 'string');
}
