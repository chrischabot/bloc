import type React from 'react';
import type { PropertyDef, RowObject } from './TableView';

function titleOf(row: RowObject, titleProp: PropertyDef): string {
  const v = row.properties[titleProp.name];
  if (!v) return '';
  const arr = v['title'] as Array<{ plain_text?: string }> | undefined;
  return arr?.map((n) => n.plain_text).join('') ?? '';
}

function rangeOf(row: RowObject, dateProp: PropertyDef): { start: Date; end: Date } | null {
  const v = row.properties[dateProp.name];
  if (!v) return null;
  const d = v['date'] as { start?: string; end?: string | null } | null | undefined;
  if (!d?.start) return null;
  const start = new Date(d.start);
  if (Number.isNaN(start.getTime())) return null;
  const end = d.end ? new Date(d.end) : start;
  return { start, end };
}

export default function TimelineView({
  properties,
  rows,
  dateProperty = 'Due',
}: {
  properties: PropertyDef[];
  rows: RowObject[];
  dateProperty?: string;
}): React.JSX.Element {
  const titleProp = properties.find((p) => p.type === 'title');
  const dateProp = properties.find((p) => p.name === dateProperty && p.type === 'date');
  if (!titleProp || !dateProp) {
    return <div className="dbview__empty">Title or date property missing.</div>;
  }
  const items = rows
    .map((row) => ({ row, range: rangeOf(row, dateProp) }))
    .filter((x): x is { row: RowObject; range: { start: Date; end: Date } } => x.range !== null);
  if (items.length === 0) {
    return <div className="dbview__empty">No dated rows.</div>;
  }
  const first = items.at(0);
  if (first === undefined) {
    return <div className="dbview__empty">No dated rows.</div>;
  }
  const min = items.reduce((m, x) => (x.range.start < m ? x.range.start : m), first.range.start);
  const max = items.reduce((m, x) => (x.range.end > m ? x.range.end : m), first.range.end);
  const totalDays = Math.max(1, Math.round((max.getTime() - min.getTime()) / 86_400_000));
  function pct(d: Date): number {
    return Math.round(((d.getTime() - min.getTime()) / 86_400_000 / totalDays) * 100);
  }
  return (
    <div className="timelineview">
      <div className="timelineview__header">
        <span className="timelineview__range-start">{min.toISOString().slice(0, 10)}</span>
        <span className="timelineview__range-end">{max.toISOString().slice(0, 10)}</span>
      </div>
      <ul className="timelineview__rows">
        {items.map(({ row, range }) => {
          const left = pct(range.start);
          const width = Math.max(2, pct(range.end) - left);
          return (
            <li key={row.id} className="timelineview__row">
              <span className="timelineview__title">{titleOf(row, titleProp) || 'Untitled'}</span>
              <div className="timelineview__track">
                <div
                  className="timelineview__bar"
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
