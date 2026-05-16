'use client';

import type { ReminderObject } from '@bloc/sdk';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useBloc } from '../lib/use-bloc.ts';

function relativeTime(iso: string): string {
  const now = Date.now();
  const target = new Date(iso).getTime();
  const diffMin = Math.round((target - now) / 60_000);
  if (diffMin < -60) return `${Math.round(-diffMin / 60)}h ago`;
  if (diffMin < 0) return `${-diffMin}m ago`;
  if (diffMin < 60) return `in ${diffMin}m`;
  if (diffMin < 24 * 60) return `in ${Math.round(diffMin / 60)}h`;
  return `in ${Math.round(diffMin / (24 * 60))}d`;
}

interface Props {
  onClose: () => void;
  /** Page id new reminders should attach to (defaults to a workspace-scoped placeholder). */
  pageId?: string;
}

export default function RemindersPanel({ onClose, pageId }: Props): React.JSX.Element {
  const { client, session } = useBloc();
  const [reminders, setReminders] = useState<ReminderObject[]>([]);
  const [label, setLabel] = useState('');
  const [showFired, setShowFired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (client === null) return;
    setLoading(true);
    setError(null);
    try {
      const result = await client.reminders.list({ include_fired: showFired });
      setReminders(result.results);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [client, showFired]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createReminder(): Promise<void> {
    if (client === null) return;
    const trimmed = label.trim();
    if (trimmed.length === 0) return;
    // If no explicit page id is provided, we need a real page to attach to. Find
    // or create one via the workspace context (any workspace-parent page works).
    let targetPage = pageId;
    if (targetPage === undefined || targetPage === null) {
      try {
        const newPage = await client.pages.create({
          parent: { type: 'workspace', workspace: true },
          icon: { type: 'emoji', emoji: '📌' },
        });
        targetPage = newPage.id;
      } catch (err) {
        setError((err as Error).message);
        return;
      }
    }
    try {
      await client.reminders.create({
        parent: { type: 'page', id: targetPage },
        due_at: new Date(Date.now() + 60 * 60_000).toISOString(),
        label: trimmed,
      });
      setLabel('');
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function fire(id: string): Promise<void> {
    if (client === null) return;
    try {
      await client.reminders.fire({ reminder_id: id });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(id: string): Promise<void> {
    if (client === null) return;
    try {
      await client.reminders.delete({ reminder_id: id });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <aside className="reminders" aria-label="Reminders">
      <header className="reminders__header">
        <h2>Reminders</h2>
        <button type="button" className="reminders__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <div className="reminders__composer">
        <input
          type="text"
          placeholder="Remind me to…"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void createReminder()}
          aria-label="New reminder"
          disabled={client === null}
        />
        <button
          type="button"
          className="reminders__add"
          onClick={() => void createReminder()}
          disabled={client === null || label.trim().length === 0}
        >
          + Add
        </button>
      </div>
      <label className="reminders__toggle">
        <input
          type="checkbox"
          checked={showFired}
          onChange={(e) => setShowFired(e.target.checked)}
        />
        <span>Show fired</span>
      </label>

      {error !== null && <p className="reminders__error">{error}</p>}

      {loading || session === null ? (
        <p className="reminders__empty">Loading…</p>
      ) : (
        <ul className="reminders__list">
          {reminders.map((r) => (
            <li key={r.id} className={`reminders__row ${r.fired ? 'is-fired' : ''}`}>
              <span className="reminders__when">{relativeTime(r.due_at)}</span>
              <span className="reminders__label">{r.label ?? '(no label)'}</span>
              <span className="reminders__actions">
                {!r.fired && (
                  <button
                    type="button"
                    onClick={() => void fire(r.id)}
                    aria-label="Mark fired"
                    title="Mark fired"
                  >
                    ✓
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void remove(r.id)}
                  aria-label="Remove"
                  title="Remove"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
          {reminders.length === 0 && <li className="reminders__empty">No reminders.</li>}
        </ul>
      )}
    </aside>
  );
}