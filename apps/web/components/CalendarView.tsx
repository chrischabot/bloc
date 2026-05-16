'use client';

import type React from 'react';
import { useMemo, useState } from 'react';
import type { PropertyDef, RowObject } from './TableView';

function titleOf(row: RowObject, titleProp: PropertyDef): string {
  const v = row.properties[titleProp.name];
  if (!v) return '';
  const arr = v['title'] as Array<{ plain_text?: string }> | undefined;
  return arr?.map((n) => n.plain_text).join('') ?? '';
}

function startOf(row: RowObject, dateProp: PropertyDef): Date | null {
  const v = row.properties[dateProp.name];
  if (!v) return null;
  const d = v['date'] as { start?: string } | null | undefined;
  if (!d?.start) return null;
  const t = new Date(d.start);
  return Number.isNaN(t.getTime()) ? null : t;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarView({
  properties,
  rows,
  dateProperty = 'Due',
}: {
  properties: PropertyDef[];
  rows: RowObject[];
  dateProperty?: string;
}): React.JSX.Element {
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()));
  const titleProp = properties.find((p) => p.type === 'title');
  const dateProp = properties.find((p) => p.name === dateProperty && p.type === 'date');

  const grid = useMemo(() => {
    const first = startOfMonth(cursor);
    const offset = first.getDay();
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      return new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    });
  }, [cursor]);

  const byDate = useMemo(() => {
    const map = new Map<string, RowObject[]>();
    if (!dateProp) return map;
    for (const row of rows) {
      const d = startOf(row, dateProp);
      if (!d) continue;
      const key = d.toISOString().slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(row);
      map.set(key, arr);
    }
    return map;
  }, [rows, dateProp]);

  if (!titleProp || !dateProp) {
    return <div className="dbview__empty">Title or date property missing.</div>;
  }

  return (
    <div className="calview">
      <header className="calview__header">
        <button
          type="button"
          onClick={() => setCursor((c) => addMonths(c, -1))}
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="calview__title">
          {cursor.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button
          type="button"
          onClick={() => setCursor((c) => addMonths(c, 1))}
          aria-label="Next month"
        >
          ›
        </button>
        <button
          type="button"
          className="calview__today"
          onClick={() => setCursor(startOfMonth(new Date()))}
        >
          Today
        </button>
      </header>
      <div className="calview__weekdays">
        {WEEKDAYS.map((d) => (
          <div key={d} className="calview__weekday">
            {d}
          </div>
        ))}
      </div>
      <div className="calview__grid">
        {grid.map((d) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const key = d.toISOString().slice(0, 10);
          const events = byDate.get(key) ?? [];
          return (
            <div key={key} className={`calview__cell ${inMonth ? '' : 'is-out'}`}>
              <span className="calview__day">{d.getDate()}</span>
              <ul className="calview__events">
                {events.slice(0, 3).map((row) => (
                  <li key={row.id} className="calview__event">
                    {titleOf(row, titleProp) || 'Untitled'}
                  </li>
                ))}
                {events.length > 3 && <li className="calview__more">+{events.length - 3} more</li>}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
