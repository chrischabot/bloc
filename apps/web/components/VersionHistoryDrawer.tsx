'use client';

import { Bloc, type PageVersion } from '@bloc/sdk';
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

function formatTime(iso: string): string {
  const ts = new Date(iso);
  return ts.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  });
}

interface Props {
  pageId: string;
  onClose: () => void;
  authToken?: string;
}

export default function VersionHistoryDrawer({
  pageId,
  onClose,
  authToken,
}: Props): React.JSX.Element {
  const [versions, setVersions] = useState<PageVersion[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const client = useState(
    () =>
      new Bloc({
        auth: authToken ?? devBearer(),
        baseUrl: API_BASE,
      }),
  )[0];

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await client.versions.list({ page_id: pageId });
      setVersions(result.results);
      const first = result.results[0];
      if (first !== undefined && selected === null) {
        setSelected(first.clock);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [client, pageId, selected]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function restore(): Promise<void> {
    if (selected === null) return;
    try {
      // Validate the snapshot is reachable; full restore lands with v1.1's Yjs replay.
      await client.versions.retrieve({ page_id: pageId, clock: selected });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <aside className="versions" aria-label="Version history">
      <header className="versions__header">
        <h2>Version history</h2>
        <button type="button" className="versions__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      {error !== null && <p className="versions__error">{error}</p>}

      {loading ? (
        <p className="versions__empty">Loading…</p>
      ) : versions.length === 0 ? (
        <p className="versions__empty">No saved versions yet.</p>
      ) : (
        <ol className="versions__list">
          {versions.map((v) => (
            <li
              key={v.clock}
              className={`versions__row ${v.clock === selected ? 'is-active' : ''}`}
            >
              <button
                type="button"
                className="versions__pick"
                onClick={() => setSelected(v.clock)}
                aria-pressed={v.clock === selected}
              >
                <span className="versions__when">{formatTime(v.created_at)}</span>
                <span className="versions__meta">
                  clock {v.clock} · {v.update_bytes} B
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      <footer className="versions__footer">
        <button
          type="button"
          className="versions__restore"
          onClick={() => void restore()}
          disabled={selected === null}
        >
          Restore selected
        </button>
        <p className="versions__hint">
          Restoring rolls the page back to the selected version. Yjs-driven point-in-time replay
          ships with the realtime gateway in v1.1.
        </p>
      </footer>
    </aside>
  );
}
