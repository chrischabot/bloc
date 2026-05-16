'use client';

import { Bloc } from '@bloc/sdk';
import type React from 'react';
import { useState } from 'react';

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

interface ArchivedPage {
  id: string;
  title: string;
  archivedAgo: string;
}

const SAMPLE: ArchivedPage[] = [
  { id: 'a-old1', title: 'Q3 retrospective draft', archivedAgo: '2 days ago' },
  { id: 'a-old2', title: 'Vendor pitch — DraftCo', archivedAgo: '5 days ago' },
  { id: 'a-old3', title: 'Onboarding checklist 2024', archivedAgo: '1 month ago' },
];

interface Props {
  onClose: () => void;
  authToken?: string;
}

export default function TrashPanel({ onClose, authToken }: Props): React.JSX.Element {
  const [pages, setPages] = useState<ArchivedPage[]>(SAMPLE);
  const [error, setError] = useState<string | null>(null);

  const client = useState(
    () => new Bloc({ auth: authToken ?? devBearer(), baseUrl: API_BASE }),
  )[0];

  async function restore(id: string): Promise<void> {
    try {
      await client.pages.update({ page_id: id, archived: false });
      setPages((curr) => curr.filter((p) => p.id !== id));
    } catch (err) {
      // Best-effort: the sample ids don't correspond to real pages in dev.
      setError(`Restore failed: ${(err as Error).message}`);
    }
  }

  function dropLocal(id: string): void {
    setPages((curr) => curr.filter((p) => p.id !== id));
  }

  return (
    <aside className="trash" aria-label="Trash">
      <header className="trash__header">
        <h2>Trash</h2>
        <button type="button" className="trash__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      {error !== null && <p className="trash__error">{error}</p>}
      <p className="trash__hint">
        Pages stay in Trash for 30 days before they're permanently deleted.
      </p>
      <ul className="trash__list">
        {pages.map((p) => (
          <li key={p.id} className="trash__row">
            <span className="trash__title">{p.title}</span>
            <span className="trash__when">{p.archivedAgo}</span>
            <span className="trash__actions">
              <button
                type="button"
                onClick={() => void restore(p.id)}
                aria-label="Restore"
                title="Restore"
              >
                ↺
              </button>
              <button
                type="button"
                onClick={() => dropLocal(p.id)}
                aria-label="Delete permanently"
                title="Delete permanently"
              >
                ×
              </button>
            </span>
          </li>
        ))}
        {pages.length === 0 && <li className="trash__empty">Nothing in Trash.</li>}
      </ul>
    </aside>
  );
}
