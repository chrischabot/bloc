import type React from 'react';
import type { PropertyDef, RowObject } from './TableView';

function groupKey(value: { type: string; [key: string]: unknown } | undefined): string {
  if (!value) return 'No value';
  const t = value.type;
  if (t === 'select' || t === 'status') {
    const opt = value[t] as { name?: string } | null | undefined;
    return opt?.name ?? 'No value';
  }
  return 'No value';
}

function titleOf(row: RowObject, titleProp: PropertyDef): string {
  const v = row.properties[titleProp.name];
  if (!v) return '';
  const arr = v['title'] as Array<{ plain_text?: string }> | undefined;
  return arr?.map((n) => n.plain_text).join('') ?? '';
}

export default function BoardView({
  properties,
  rows,
  groupBy,
}: {
  properties: PropertyDef[];
  rows: RowObject[];
  /** Property name to group by (must be select/status). */
  groupBy: string;
}): React.JSX.Element {
  const groupProp = properties.find((p) => p.name === groupBy);
  const titleProp = properties.find((p) => p.type === 'title');
  if (!groupProp || !titleProp) {
    return <div className="dbview__empty">Group-by or title property missing.</div>;
  }
  const groups = new Map<string, RowObject[]>();
  for (const row of rows) {
    const key = groupKey(row.properties[groupBy]);
    const arr = groups.get(key) ?? [];
    arr.push(row);
    groups.set(key, arr);
  }
  return (
    <div className="boardview">
      {Array.from(groups.entries()).map(([col, items]) => (
        <section key={col} className="boardview__col">
          <header className="boardview__col-header">
            <span className="boardview__col-title">{col}</span>
            <span className="boardview__count">{items.length}</span>
          </header>
          <ul className="boardview__cards">
            {items.map((row) => (
              <li key={row.id} className="boardview__card">
                {titleOf(row, titleProp) || 'Untitled'}
              </li>
            ))}
            {items.length === 0 && <li className="boardview__empty">No cards</li>}
          </ul>
          <button type="button" className="boardview__add">
            + New
          </button>
        </section>
      ))}
    </div>
  );
}
