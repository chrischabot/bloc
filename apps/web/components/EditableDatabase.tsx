'use client';

import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBloc } from '../lib/use-bloc.ts';
import BoardView from './BoardView.tsx';
import CalendarView from './CalendarView.tsx';
import GalleryView from './GalleryView.tsx';
import ListView from './ListView.tsx';
import type { PropertyDef, RowObject } from './TableView.tsx';
import TimelineView from './TimelineView.tsx';

type ViewType = 'table' | 'board' | 'gallery' | 'list' | 'calendar' | 'timeline';

const VIEW_LABEL: Record<ViewType, string> = {
  table: 'Table',
  board: 'Board',
  gallery: 'Gallery',
  list: 'List',
  calendar: 'Calendar',
  timeline: 'Timeline',
};

interface DatabaseDoc {
  id: string;
  title: string;
}

function databaseTitle(record: Record<string, unknown>): string {
  const arr =
    (record['title'] as
      | Array<{ plain_text?: string; text?: { content?: string } }>
      | undefined) ?? [];
  const text = arr
    .map((n) => {
      const pt = n.plain_text;
      if (typeof pt === 'string' && pt.length > 0) return pt;
      return n.text?.content ?? '';
    })
    .join('');
  return text.length > 0 ? text : 'Untitled database';
}

function propertiesFromSchema(schema: Record<string, unknown>): PropertyDef[] {
  return Object.entries(schema).map(([name, def]) => {
    const d = def as { id: string; type: string };
    return { id: d.id, name, type: d.type };
  });
}

function rowsFromQueryResults(results: Array<Record<string, unknown>>): RowObject[] {
  return results.map((r) => {
    const props =
      (r['properties'] as Record<string, { type: string; [key: string]: unknown }>) ?? {};
    return { id: String(r['id']), properties: props };
  });
}

interface CellEditorProps {
  prop: PropertyDef;
  value: { type: string; [key: string]: unknown } | undefined;
  onChange: (next: { type: string; [key: string]: unknown }) => void;
}

function CellEditor({ prop, value, onChange }: CellEditorProps): React.JSX.Element {
  switch (prop.type) {
    case 'title': {
      const arr = (value?.['title'] as Array<{ plain_text?: string }> | undefined) ?? [];
      const text = arr.map((n) => n.plain_text ?? '').join('');
      return (
        <input
          type="text"
          className="cell-input"
          value={text}
          onChange={(e) =>
            onChange({
              type: 'title',
              title: [
                {
                  type: 'text',
                  text: { content: e.target.value, link: null },
                  plain_text: e.target.value,
                  href: null,
                  annotations: {
                    bold: false,
                    italic: false,
                    strikethrough: false,
                    underline: false,
                    code: false,
                    color: 'default',
                  },
                },
              ],
            })
          }
          data-testid={`cell-title-${prop.id}`}
        />
      );
    }
    case 'rich_text': {
      const arr = (value?.['rich_text'] as Array<{ plain_text?: string }> | undefined) ?? [];
      const text = arr.map((n) => n.plain_text ?? '').join('');
      return (
        <input
          type="text"
          className="cell-input"
          value={text}
          onChange={(e) =>
            onChange({
              type: 'rich_text',
              rich_text: [
                {
                  type: 'text',
                  text: { content: e.target.value, link: null },
                  plain_text: e.target.value,
                  href: null,
                  annotations: {
                    bold: false,
                    italic: false,
                    strikethrough: false,
                    underline: false,
                    code: false,
                    color: 'default',
                  },
                },
              ],
            })
          }
          data-testid={`cell-rich-${prop.id}`}
        />
      );
    }
    case 'number': {
      const n = (value?.['number'] as number | null | undefined) ?? null;
      return (
        <input
          type="number"
          className="cell-input"
          value={n === null ? '' : n}
          onChange={(e) =>
            onChange({
              type: 'number',
              number: e.target.value === '' ? null : Number(e.target.value),
            })
          }
          data-testid={`cell-number-${prop.id}`}
        />
      );
    }
    case 'checkbox': {
      const c = Boolean(value?.['checkbox']);
      return (
        <input
          type="checkbox"
          checked={c}
          onChange={(e) => onChange({ type: 'checkbox', checkbox: e.target.checked })}
          data-testid={`cell-checkbox-${prop.id}`}
        />
      );
    }
    case 'select': {
      const sel = value?.['select'] as { name?: string } | null | undefined;
      return (
        <input
          type="text"
          className="cell-input"
          value={sel?.name ?? ''}
          placeholder="Type option name…"
          onChange={(e) =>
            onChange({
              type: 'select',
              select: e.target.value === '' ? null : { name: e.target.value },
            })
          }
          data-testid={`cell-select-${prop.id}`}
        />
      );
    }
    case 'status': {
      const status = value?.['status'] as { name?: string } | null | undefined;
      return (
        <input
          type="text"
          className="cell-input"
          value={status?.name ?? ''}
          placeholder="Status…"
          onChange={(e) =>
            onChange({
              type: 'status',
              status: e.target.value === '' ? null : { name: e.target.value },
            })
          }
          data-testid={`cell-status-${prop.id}`}
        />
      );
    }
    case 'date': {
      const d = value?.['date'] as { start?: string } | null | undefined;
      return (
        <input
          type="date"
          className="cell-input"
          value={d?.start?.slice(0, 10) ?? ''}
          onChange={(e) =>
            onChange({
              type: 'date',
              date:
                e.target.value === ''
                  ? null
                  : { start: e.target.value, end: null, time_zone: null },
            })
          }
          data-testid={`cell-date-${prop.id}`}
        />
      );
    }
    case 'url':
    case 'email':
    case 'phone_number': {
      const t = (value?.[prop.type] as string | null | undefined) ?? '';
      return (
        <input
          type="text"
          className="cell-input"
          value={t}
          onChange={(e) =>
            onChange({
              type: prop.type,
              [prop.type]: e.target.value === '' ? null : e.target.value,
            })
          }
          data-testid={`cell-${prop.type}-${prop.id}`}
        />
      );
    }
    default:
      return <span className="cell-readonly">—</span>;
  }
}

export default function EditableDatabase({
  databaseId,
}: {
  databaseId: string;
}): React.JSX.Element {
  const { client, loading: sessionLoading } = useBloc();
  const [db, setDb] = useState<DatabaseDoc | null>(null);
  const [properties, setProperties] = useState<PropertyDef[]>([]);
  const [rows, setRows] = useState<RowObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewType>('table');

  const refresh = useCallback(async () => {
    if (client === null) return;
    setLoading(true);
    setError(null);
    try {
      const dbRow = (await client.databases.retrieve({
        database_id: databaseId,
      })) as unknown as Record<string, unknown>;
      setDb({ id: databaseId, title: databaseTitle(dbRow) });
      setProperties(propertiesFromSchema(dbRow['properties'] as Record<string, unknown>));
      const query = await client.databases.query({ database_id: databaseId });
      setRows(rowsFromQueryResults(query.results));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [client, databaseId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const titleProp = useMemo(() => properties.find((p) => p.type === 'title'), [properties]);

  const addRow = useCallback(async () => {
    if (client === null || titleProp === undefined) return;
    try {
      await client.pages.create({
        parent: { type: 'database_id', database_id: databaseId },
        properties: {
          [titleProp.name]: {
            title: [
              {
                type: 'text',
                text: { content: 'New row', link: null },
                plain_text: 'New row',
                href: null,
                annotations: {
                  bold: false,
                  italic: false,
                  strikethrough: false,
                  underline: false,
                  code: false,
                  color: 'default',
                },
              },
            ],
          },
        },
      });
      await refresh();
    } catch {
      // ignore
    }
  }, [client, databaseId, refresh, titleProp]);

  const updateCell = useCallback(
    async (rowId: string, prop: PropertyDef, next: { type: string; [key: string]: unknown }) => {
      if (client === null) return;
      setRows((curr) =>
        curr.map((r) =>
          r.id === rowId ? { ...r, properties: { ...r.properties, [prop.name]: next } } : r,
        ),
      );
      try {
        await client.pages.update({
          page_id: rowId,
          properties: { [prop.name]: next },
        });
      } catch {
        // ignore
      }
    },
    [client],
  );

  const groupBy = useMemo(() => {
    const status = properties.find((p) => p.type === 'status');
    const select = properties.find((p) => p.type === 'select');
    return status?.name ?? select?.name ?? properties[0]?.name ?? 'Name';
  }, [properties]);

  if (sessionLoading || loading) {
    return (
      <article className="editor" data-testid="db-loading">
        <p>Loading…</p>
      </article>
    );
  }
  if (error !== null) {
    return (
      <article className="editor" data-testid="db-error">
        <p>Error: {error}</p>
      </article>
    );
  }
  if (db === null) {
    return (
      <article className="editor" data-testid="db-missing">
        <p>Database not found.</p>
      </article>
    );
  }

  return (
    <article className="editor" data-testid="editable-database">
      <header className="editor__header">
        <h1 className="editor__title" data-testid="db-title">
          {db.title}
        </h1>
      </header>
      <section className="editor__body">
        <nav className="dbview-tabs__bar" aria-label="View tabs">
          {(Object.keys(VIEW_LABEL) as ViewType[]).map((v) => (
            <button
              key={v}
              type="button"
              className={`dbview-tabs__tab ${view === v ? 'is-active' : ''}`}
              onClick={() => setView(v)}
              data-testid={`view-${v}`}
            >
              {VIEW_LABEL[v]}
            </button>
          ))}
          <button
            type="button"
            className="dbview-tabs__tab"
            onClick={() => void addRow()}
            data-testid="db-add-row"
          >
            + New row
          </button>
        </nav>
        <div className="dbview-tabs__pane">
          {view === 'table' && (
            <section className="dbview-edit" aria-label="Editable database table">
              <table className="db-editor">
                <thead>
                  <tr>
                    {properties.map((p) => (
                      <th key={p.id} data-testid={`col-${p.name}`}>
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} data-testid={`row-${row.id}`}>
                      {properties.map((p) => (
                        <td key={p.id}>
                          <CellEditor
                            prop={p}
                            value={row.properties[p.name]}
                            onChange={(next) => void updateCell(row.id, p, next)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={properties.length} className="db-editor__empty">
                        No rows yet. Click "+ New row".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}
          {view === 'board' && <BoardView properties={properties} rows={rows} groupBy={groupBy} />}
          {view === 'gallery' && <GalleryView properties={properties} rows={rows} />}
          {view === 'list' && <ListView properties={properties} rows={rows} />}
          {view === 'calendar' && <CalendarView properties={properties} rows={rows} />}
          {view === 'timeline' && <TimelineView properties={properties} rows={rows} />}
        </div>
      </section>
    </article>
  );
}
