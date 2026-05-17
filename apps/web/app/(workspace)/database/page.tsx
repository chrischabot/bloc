'use client';

import { useCallback, useEffect, useState } from 'react';
import { useBloc } from '../../../lib/use-bloc.ts';

interface DbItem {
  id: string;
  title: string;
}

function deriveTitle(record: Record<string, unknown>): string {
  const arr = record['title'] as Array<{ plain_text?: string }> | undefined;
  const text = arr?.map((n) => n.plain_text ?? '').join('') ?? '';
  return text.length > 0 ? text : 'Untitled database';
}

export default function DatabaseLauncher(): React.JSX.Element {
  const { client, session } = useBloc();
  const [items, setItems] = useState<DbItem[]>([]);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    if (client === null) return;
    const result = await client.search({
      query: '',
      filter: { value: 'database', property: 'object' },
      page_size: 100,
    });
    setItems(
      result.results.map((row) => {
        const r = row as Record<string, unknown>;
        return { id: String(r['id']), title: deriveTitle(r) };
      }),
    );
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createDatabase(): Promise<void> {
    if (client === null || session === null) return;
    setCreating(true);
    try {
      // We need a parent — find or create a "Workspace root" page.
      const search = await client.search({ query: 'Workspace root', page_size: 5 });
      let parentPageId: string | null = null;
      for (const r of search.results) {
        const row = r as Record<string, unknown>;
        if (row['object'] === 'page') {
          parentPageId = String(row['id']);
          break;
        }
      }
      if (parentPageId === null) {
        const created = await client.pages.create({
          parent: { type: 'workspace', workspace: true },
          icon: { type: 'emoji', emoji: '🏠' },
        });
        parentPageId = created.id;
      }
      const db = await client.databases.create({
        parent: { type: 'page_id', page_id: parentPageId },
        title: [{ type: 'text', text: { content: 'New database', link: null } }],
        properties: {
          Name: { type: 'title', title: {} },
          Status: {
            type: 'status',
            status: {
              options: [
                { name: 'To-do', color: 'gray' },
                { name: 'In progress', color: 'blue' },
                { name: 'Done', color: 'green' },
              ],
            },
          },
          Due: { type: 'date', date: {} },
          Done: { type: 'checkbox', checkbox: {} },
        },
      });
      window.dispatchEvent(new Event('bloc:sidebar:refresh'));
      window.location.href = `/database/${db.id}`;
    } finally {
      setCreating(false);
    }
  }

  return (
    <article className="editor" data-testid="database-launcher">
      <header className="editor__header">
        <h1 className="editor__title">Databases</h1>
        <p className="editor__subtitle">Open an existing database or create a new one.</p>
      </header>
      <section className="editor__body">
        <button
          type="button"
          onClick={() => void createDatabase()}
          className="settings__cta"
          disabled={creating || client === null}
          data-testid="database-new"
        >
          {creating ? 'Creating…' : '+ New database'}
        </button>
        <ul className="listview" data-testid="database-list">
          {items.map((db) => (
            <li key={db.id} className="listview__row">
              <a
                className="listview__title"
                href={`/database/${db.id}`}
                data-testid={`db-${db.id}`}
              >
                {db.title}
              </a>
            </li>
          ))}
          {items.length === 0 && <li className="listview__row">No databases yet.</li>}
        </ul>
      </section>
    </article>
  );
}
