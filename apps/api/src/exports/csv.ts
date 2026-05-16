import { type ClientHandle, listPageProperties, listProperties } from '@bloc/db';
import { schema } from '@bloc/db';
import { and, asc, eq } from 'drizzle-orm';

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function scalarOf(value: Record<string, unknown> | undefined, type: string): string {
  if (!value) return '';
  const v = value[type];
  switch (type) {
    case 'title':
    case 'rich_text': {
      const arr = v as Array<{ plain_text?: string; text?: { content?: string } }> | undefined;
      return arr?.map((n) => n.plain_text || n.text?.content || '').join('') ?? '';
    }
    case 'number':
      return typeof v === 'number' ? String(v) : '';
    case 'select':
    case 'status':
      return (v as { name?: string } | null)?.name ?? '';
    case 'multi_select':
      return ((v as Array<{ name?: string }> | undefined) ?? [])
        .map((o) => o.name ?? '')
        .join(', ');
    case 'date': {
      const d = v as { start?: string; end?: string | null } | null;
      if (!d?.start) return '';
      return d.end ? `${d.start} → ${d.end}` : d.start;
    }
    case 'people':
      return ((v as Array<{ id?: string }> | undefined) ?? []).map((u) => u.id ?? '').join(', ');
    case 'checkbox':
      return v === true ? 'true' : 'false';
    case 'url':
    case 'email':
    case 'phone_number':
      return typeof v === 'string' ? v : '';
    case 'relation':
      return ((v as Array<{ id?: string }> | undefined) ?? []).map((r) => r.id ?? '').join(', ');
    case 'created_time':
    case 'last_edited_time':
      return typeof v === 'string' ? v : '';
    case 'created_by':
    case 'last_edited_by':
      return (v as { id?: string } | null)?.id ?? '';
    default:
      return '';
  }
}

export async function exportDatabaseAsCsv(
  handle: ClientHandle,
  databaseId: string,
): Promise<string> {
  const props = await listProperties(handle.db, databaseId);
  // listProperties already orders by position; keep insertion order.
  const orderedProps = props;
  const rows = await handle.db
    .select()
    .from(schema.pages)
    .where(
      and(
        eq(schema.pages.parentId, databaseId),
        eq(schema.pages.parentType, 'database'),
        eq(schema.pages.archived, false),
      ),
    )
    .orderBy(asc(schema.pages.createdAt));

  const lines: string[] = [];
  lines.push(orderedProps.map((p) => escapeCsv(p.name)).join(','));
  for (const row of rows) {
    const values = await listPageProperties(handle.db, row.id);
    const valueById = new Map(
      values.map((v) => [v.propertyId, v.value as Record<string, unknown>]),
    );
    const cells = orderedProps.map((p) => {
      const v = valueById.get(p.id);
      return escapeCsv(scalarOf(v, p.type));
    });
    lines.push(cells.join(','));
  }
  return lines.join('\n');
}
