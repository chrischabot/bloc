import type { ClientHandle } from '@bloc/db';
import { schema } from '@bloc/db';
import type { V3Operation } from '@bloc/shared';
import { eq } from 'drizzle-orm';

export interface ExecuteResult {
  applied: number;
  skipped: number;
}

/**
 * Execute a list of v3 transaction operations against the relational tables.
 * Behaviour-compatible with notion-py's submitTransaction; not byte-compatible
 * (we don't ship the full set of side-tables — see docs/architecture/09).
 */
export async function executeOperations(
  handle: ClientHandle,
  ops: V3Operation[],
  actor: { userId: string; workspaceId: string },
): Promise<ExecuteResult> {
  let applied = 0;
  let skipped = 0;
  for (const op of ops) {
    const ok = await applyOne(handle, op, actor);
    if (ok) applied += 1;
    else skipped += 1;
  }
  return { applied, skipped };
}

async function applyOne(
  handle: ClientHandle,
  op: V3Operation,
  actor: { userId: string; workspaceId: string },
): Promise<boolean> {
  // Only `block` table operations are implemented in v1; other tables are
  // skipped for forward compatibility (clients can still send them).
  if (op.table !== 'block') return false;
  const [row] = await handle.db
    .select()
    .from(schema.blocks)
    .where(eq(schema.blocks.id, op.id))
    .limit(1);
  if (!row) {
    // Allow `update` to create a new block when the row is missing — Notion's
    // v3 behaviour for new-block insertion via update operation.
    if (op.command === 'update' && op.path.length === 0) {
      const value = op.args as Record<string, unknown>;
      const blockType = (value['type'] as string) ?? 'paragraph';
      const parentId = (value['parent_id'] as string) ?? '';
      const parentType = (value['parent_table'] as string) === 'block' ? 'block' : 'page';
      if (parentId === '') return false;
      await handle.db.insert(schema.blocks).values({
        id: op.id,
        workspaceId: actor.workspaceId,
        parentType: parentType as 'block' | 'page' | 'database',
        parentId,
        position: (value['position'] as string) ?? 'V',
        type: blockType,
        content: (value['properties'] as Record<string, unknown>) ?? {},
        createdBy: actor.userId,
        lastEditedBy: actor.userId,
      });
      return true;
    }
    return false;
  }

  if (op.command === 'set' && op.path[0] === 'alive') {
    await handle.db
      .update(schema.blocks)
      .set({
        archived: op.args === false,
        version: row.version + 1,
        lastEditedBy: actor.userId,
        lastEditedAt: new Date(),
      })
      .where(eq(schema.blocks.id, op.id));
    return true;
  }

  if (op.command === 'set' && op.path[0] === 'properties' && op.path.length === 2) {
    // properties.title = [...]
    const propKey = op.path[1] ?? '';
    const next = { ...(row.content as Record<string, unknown>) };
    const typeContent = next[row.type] as Record<string, unknown> | undefined;
    if (typeContent !== undefined && propKey === 'title') {
      typeContent['rich_text'] = op.args;
    } else {
      next[propKey] = op.args;
    }
    await handle.db
      .update(schema.blocks)
      .set({
        content: next as Record<string, unknown>,
        version: row.version + 1,
        lastEditedBy: actor.userId,
        lastEditedAt: new Date(),
      })
      .where(eq(schema.blocks.id, op.id));
    return true;
  }

  if (op.command === 'update' && op.path.length === 0) {
    const value = op.args as Record<string, unknown>;
    const next = {
      ...(row.content as Record<string, unknown>),
      ...((value['properties'] as Record<string, unknown>) ?? {}),
    };
    await handle.db
      .update(schema.blocks)
      .set({
        content: next as Record<string, unknown>,
        version: row.version + 1,
        lastEditedBy: actor.userId,
        lastEditedAt: new Date(),
      })
      .where(eq(schema.blocks.id, op.id));
    return true;
  }

  // listAfter / listBefore / listRemove only meaningful for the `content` list.
  if (op.path.length === 1 && op.path[0] === 'content') {
    // These operations reparent another block; we don't yet maintain a
    // synthetic order column on the parent, so we just bump version.
    await handle.db
      .update(schema.blocks)
      .set({ version: row.version + 1, lastEditedAt: new Date() })
      .where(eq(schema.blocks.id, op.id));
    return true;
  }

  return false;
}
