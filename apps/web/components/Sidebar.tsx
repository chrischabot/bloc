'use client';

import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useBloc } from '../lib/use-bloc.ts';
import InboxPanel from './InboxPanel';
import RemindersPanel from './RemindersPanel.tsx';
import TemplatesGallery from './TemplatesGallery.tsx';
import TrashPanel from './TrashPanel.tsx';

interface PageTreeItem {
  id: string;
  title: string;
  icon?: string;
  href: string;
  isDatabase: boolean;
}

function deriveTitle(record: Record<string, unknown>): string {
  if (record['object'] === 'database') {
    const arr = record['title'] as Array<{ plain_text?: string }> | undefined;
    const text = arr?.map((n) => n.plain_text).join('') ?? '';
    return text.length > 0 ? text : 'Untitled database';
  }
  if (typeof record['title'] === 'string' && (record['title'] as string).length > 0) {
    return record['title'] as string;
  }
  const properties = record['properties'] as Record<string, unknown> | undefined;
  if (properties !== undefined) {
    for (const v of Object.values(properties)) {
      if (v !== null && typeof v === 'object' && (v as { type?: string }).type === 'title') {
        const t = (v as { title?: Array<{ plain_text?: string }> }).title;
        const text = t?.map((n) => n.plain_text).join('') ?? '';
        if (text.length > 0) return text;
      }
    }
  }
  return 'Untitled';
}

function deriveIcon(record: Record<string, unknown>): string | undefined {
  const icon = record['icon'] as Record<string, unknown> | null | undefined;
  if (icon === null || icon === undefined) return undefined;
  if (icon['type'] === 'emoji' && typeof icon['emoji'] === 'string') {
    return icon['emoji'] as string;
  }
  return undefined;
}

export default function Sidebar(): React.JSX.Element {
  const { client } = useBloc();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [items, setItems] = useState<PageTreeItem[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    if (client === null) return;
    try {
      const [pagesResult, dbsResult] = await Promise.all([
        client.search({
          query: '',
          page_size: 100,
          filter: { value: 'page', property: 'object' },
        }),
        client.search({
          query: '',
          page_size: 100,
          filter: { value: 'database', property: 'object' },
        }),
      ]);
      const combined = [...pagesResult.results, ...dbsResult.results];
      const list: PageTreeItem[] = combined.map((row) => {
        const r = row as Record<string, unknown>;
        const isDatabase = r['object'] === 'database';
        const id = String(r['id'] ?? '');
        return {
          id,
          title: deriveTitle(r),
          icon: deriveIcon(r),
          isDatabase,
          href: isDatabase ? `/database/${id}` : `/page/${id}`,
        };
      });
      setItems(list);
    } catch {
      setItems([]);
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Listen for global page-create / page-delete events so any pane (templates
  // gallery, page route, etc.) can ping the sidebar to refresh without prop-
  // drilling. Custom event name: `bloc:sidebar:refresh`.
  useEffect(() => {
    const handler = (): void => {
      void refresh();
    };
    window.addEventListener('bloc:sidebar:refresh', handler);
    return () => window.removeEventListener('bloc:sidebar:refresh', handler);
  }, [refresh]);

  async function createPage(): Promise<void> {
    if (client === null) return;
    setCreating(true);
    try {
      const page = await client.pages.create({
        parent: { type: 'workspace', workspace: true },
        icon: { type: 'emoji', emoji: '📄' },
      });
      window.dispatchEvent(new Event('bloc:sidebar:refresh'));
      window.location.href = `/page/${page.id}`;
    } catch {
      // ignore — surface in UI via separate notification system in v1.1
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <aside
        className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''} ${mobileOpen ? 'sidebar--open' : ''}`}
        aria-label="Sidebar"
      >
        <div className="sidebar__workspace">
          <span className="sidebar__icon" aria-hidden>
            ◯
          </span>
          <span className="sidebar__title">Dev Workspace</span>
          <button
            type="button"
            className="sidebar__collapse"
            onClick={() => {
              setCollapsed((v) => !v);
              setMobileOpen(false);
            }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        <ul className="sidebar__quick" aria-label="Quick actions">
          <li>
            <button
              type="button"
              className="sidebar__action"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
            >
              🔍 <span>Search</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className="sidebar__action"
              aria-label="Inbox"
              onClick={() => setInboxOpen(true)}
            >
              🔔 <span>Updates</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className="sidebar__action"
              aria-label="Reminders"
              onClick={() => setRemindersOpen(true)}
            >
              ⏰ <span>Reminders</span>
            </button>
          </li>
          <li>
            <a className="sidebar__action" href="/settings" aria-label="Settings">
              ⚙ <span>Settings</span>
            </a>
          </li>
          <li>
            <button
              type="button"
              className="sidebar__action sidebar__new-page"
              aria-label="New page"
              onClick={() => void createPage()}
              disabled={creating || client === null}
              data-testid="sidebar-new-page"
            >
              ＋ <span>{creating ? 'Creating…' : 'New page'}</span>
            </button>
          </li>
        </ul>

        <Section title="Favourites" items={[]} />
        <Section title="Teamspaces" items={[]} />
        <Section title="Shared" items={[]} />
        <Section title="Private" items={items} />

        <ul className="sidebar__footer" aria-label="Sidebar footer">
          <li>
            <button
              type="button"
              className="sidebar__action"
              onClick={() => setTemplatesOpen(true)}
            >
              📄 Templates
            </button>
          </li>
          <li>
            <a className="sidebar__action" href="/analytics">
              📊 Analytics
            </a>
          </li>
          <li>
            <button type="button" className="sidebar__action">
              ⬇ Import
            </button>
          </li>
          <li>
            <button type="button" className="sidebar__action" onClick={() => setTrashOpen(true)}>
              🗑 Trash
            </button>
          </li>
        </ul>
      </aside>
      {inboxOpen && <InboxPanel onClose={() => setInboxOpen(false)} />}
      {remindersOpen && <RemindersPanel onClose={() => setRemindersOpen(false)} />}
      {trashOpen && <TrashPanel onClose={() => setTrashOpen(false)} />}
      {templatesOpen && <TemplatesGallery onClose={() => setTemplatesOpen(false)} />}
      {searchOpen && (
        <div className="qs__scrim">
          <button
            type="button"
            className="qs__scrim-dismiss"
            aria-label="Dismiss search hint"
            onClick={() => setSearchOpen(false)}
          />
          <section className="qs" aria-label="Search hint">
            <p style={{ padding: 24, margin: 0 }}>
              Press <kbd>Cmd</kbd>+<kbd>K</kbd> (or <kbd>Ctrl</kbd>+<kbd>K</kbd>) to open the quick
              switcher.
            </p>
          </section>
        </div>
      )}
    </>
  );
}

function Section({ title, items }: { title: string; items: PageTreeItem[] }): React.JSX.Element {
  const [open, setOpen] = useState(true);
  if (items.length === 0 && title !== 'Private') return <></>;
  return (
    <div className="sidebar__section">
      <button
        type="button"
        className="sidebar__section-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="sidebar__chevron">{open ? '▾' : '▸'}</span>
        <span className="sidebar__section-title">{title}</span>
      </button>
      {open && (
        <ul className="sidebar__pagelist">
          {items.map((p) => (
            <li key={p.id}>
              <a className="sidebar__page" href={p.href} data-testid={`sidebar-page-${p.id}`}>
                <span className="sidebar__page-icon" aria-hidden>
                  {p.icon ?? (p.isDatabase ? '⌗' : '📄')}
                </span>
                <span className="sidebar__page-title">{p.title}</span>
              </a>
            </li>
          ))}
          {items.length === 0 && (
            <li>
              <span className="sidebar__empty">
                {title === 'Private' ? 'No pages inside. Add a page.' : 'No pages.'}
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
