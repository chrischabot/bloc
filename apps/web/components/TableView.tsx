import type React from 'react';

export interface PropertyDef {
  id: string;
  name: string;
  type: string;
}

export interface RowObject {
  id: string;
  properties: Record<string, { type: string; [key: string]: unknown }>;
}

function cellRender(value: { type: string; [key: string]: unknown } | undefined): React.ReactNode {
  if (!value) return null;
  switch (value.type) {
    case 'title':
    case 'rich_text': {
      const arr = value[value.type] as Array<{ plain_text?: string }> | undefined;
      return arr?.map((n) => n.plain_text).join('') ?? '';
    }
    case 'number':
      return typeof value['number'] === 'number' ? value['number'] : '';
    case 'select':
    case 'status': {
      const opt = value[value.type] as { name?: string; color?: string } | null | undefined;
      if (!opt) return '';
      return <span className={`tag tag--${opt.color ?? 'default'}`}>{opt.name}</span>;
    }
    case 'multi_select': {
      const opts = value['multi_select'] as Array<{ name?: string; color?: string }> | undefined;
      return (
        <span className="tag-stack">
          {(opts ?? []).map((o, i) => (
            <span key={`${i}-${o.name ?? ''}`} className={`tag tag--${o.color ?? 'default'}`}>
              {o.name}
            </span>
          ))}
        </span>
      );
    }
    case 'date': {
      const d = value['date'] as { start?: string; end?: string | null } | null | undefined;
      return d?.start ?? '';
    }
    case 'checkbox':
      return value['checkbox'] ? '☑' : '☐';
    case 'url': {
      const url = value['url'];
      return typeof url === 'string' ? <a href={url}>{url}</a> : '';
    }
    default:
      return '';
  }
}

export default function TableView({
  properties,
  rows,
}: {
  properties: PropertyDef[];
  rows: RowObject[];
}): React.JSX.Element {
  return (
    <table className="dbview dbview--table">
      <thead className="dbview__head">
        <tr>
          {properties.map((p) => (
            <th key={p.id} className="dbview__cell dbview__cell--head" scope="col">
              <span className="dbview__type" aria-hidden>
                {p.type === 'title'
                  ? 'Aa'
                  : p.type === 'number'
                    ? '#'
                    : p.type === 'date'
                      ? '📅'
                      : '·'}
              </span>
              {p.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="dbview__body">
        {rows.map((row) => (
          <tr key={row.id} className="dbview__row">
            {properties.map((p) => (
              <td key={p.id} className="dbview__cell">
                {cellRender(row.properties[p.name])}
              </td>
            ))}
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td className="dbview__empty" colSpan={properties.length}>
              No rows yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
