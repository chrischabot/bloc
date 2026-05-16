import type React from 'react';
import type { PropertyDef, RowObject } from './TableView';

function titleOf(row: RowObject, titleProp: PropertyDef): string {
  const v = row.properties[titleProp.name];
  if (!v) return '';
  const arr = v['title'] as Array<{ plain_text?: string }> | undefined;
  return arr?.map((n) => n.plain_text).join('') ?? '';
}

function chipFor(value: { type: string; [key: string]: unknown } | undefined): React.ReactNode {
  if (!value) return null;
  if (value.type === 'select' || value.type === 'status') {
    const opt = value[value.type] as { name?: string; color?: string } | null | undefined;
    return opt ? <span className={`tag tag--${opt.color ?? 'default'}`}>{opt.name}</span> : null;
  }
  if (value.type === 'date') {
    const d = value['date'] as { start?: string } | null | undefined;
    return d?.start ? <span className="tag tag--default">{d.start}</span> : null;
  }
  return null;
}

export default function ListView({
  properties,
  rows,
}: {
  properties: PropertyDef[];
  rows: RowObject[];
}): React.JSX.Element {
  const titleProp = properties.find((p) => p.type === 'title');
  if (!titleProp) return <div className="dbview__empty">Title property missing.</div>;
  const otherProps = properties.filter((p) => p.id !== titleProp.id).slice(0, 4);
  return (
    <ul className="listview">
      {rows.map((row) => (
        <li key={row.id} className="listview__row">
          <span className="listview__title">{titleOf(row, titleProp) || 'Untitled'}</span>
          <span className="listview__chips">
            {otherProps.map((p) => (
              <span key={p.id}>{chipFor(row.properties[p.name])}</span>
            ))}
          </span>
        </li>
      ))}
      {rows.length === 0 && <li className="dbview__empty">No rows.</li>}
    </ul>
  );
}
