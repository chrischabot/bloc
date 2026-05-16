'use client';

import { type InboxEntry, Bloc } from '@bloc/sdk';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';

const API_BASE =
  typeof process !== 'undefined' && process.env['NEXT_PUBLIC_API_URL']
    ? process.env['NEXT_PUBLIC_API_URL']
    : 'http://localhost:3001';

function devBearer(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const w = params.get('w') ?? '00000000-0000-0000-0000-000000000001';
    const u = params.get('u') ?? '00000000-0000-0000-0000-000000000002';
    return `Bearer test_${w}_${u}`;
  }
  return 'Bearer test_00000000-0000-0000-0000-000000000001_00000000-0000-0000-0000-000000000002';
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const target = new Date(iso).getTime();
  const diffMin = Math.round((now - target) / 60_000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 24 * 60) return `${Math.round(diffMin / 60)}h ago`;
  return `${Math.round(diffMin / (24 * 60))}d ago`;
}

type Tab = 'all' | 'mention' | 'following';

const TAB_LABEL: Record<Tab, string> = {
  all: 'All',
  mention: 'Mentions',
  following: 'Following',
};

function tabToKind(tab: Tab): 'all' | 'mention' | 'comment' | 'page_update' {
  if (tab === 'all') return 'all';
  if (tab === 'mention') return 'mention';
  return 'page_update';
}

interface Props {
  onClose: () => void;
  authToken?: string;
}

export default function InboxPanel({ onClose, authToken }: Props): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('all');
  const [entries, setEntries] = useState<InboxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const client = useState(
    () => new Bloc({ auth: authToken ?? devBearer(), baseUrl: API_BASE }),
  )[0];

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await client.inbox.list({ kind: tabToKind(tab), page_size: 50 });
      setEntries(result.results);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [client, tab]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <aside className="inbox" aria-label="Updates">
      <header className="inbox__header">
        <h2>Updates</h2>
        <button type="button" className="inbox__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <nav className="inbox__tabs" aria-label="Tabs">
        {(['all', 'mention', 'following'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`inbox__tab ${tab === t ? 'is-active' : ''}`}
            onClick={() => setTab(t)}
            aria-selected={tab === t}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </nav>
      {error !== null && <p className="inbox__error">{error}</p>}
      {loading ? (
        <p className="inbox__empty">Loading…</p>
      ) : (
        <ul className="inbox__list">
          {entries.map((n) => (
            <li key={n.id} className="inbox__item">
              <span className="inbox__avatar" aria-hidden>
                {n.actor_user_id?.[0]?.toUpperCase() ?? '·'}
              </span>
              <div className="inbox__body">
                <span>
                  <strong>{n.actor_user_id?.slice(0, 8) ?? 'Someone'}</strong>{' '}
                  {n.kind === 'mention'
                    ? 'mentioned you in'
                    : n.kind === 'comment'
                      ? 'commented on'
                      : 'edited'}{' '}
                  <em>{n.target_page_id.slice(0, 8)}…</em>
                  {n.snippet !== null && (
                    <span className="inbox__snippet"> — {n.snippet.slice(0, 60)}</span>
                  )}
                </span>
                <span className="inbox__ts">{relativeTime(n.created_at)}</span>
              </div>
            </li>
          ))}
          {entries.length === 0 && <li className="inbox__empty">All caught up.</li>}
        </ul>
      )}
    </aside>
  );
}
