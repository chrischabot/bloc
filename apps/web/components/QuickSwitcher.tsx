'use client';

import { Bloc } from '@bloc/sdk';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

interface SearchResult {
  id: string;
  object: string;
  url: string;
  title: string;
  icon?: string;
}

function deriveTitle(record: Record<string, unknown>): string {
  if (record['object'] === 'database') {
    const title = record['title'] as Array<{ plain_text?: string }> | undefined;
    return title?.map((n) => n.plain_text).join('') ?? 'Untitled database';
  }
  return 'Untitled page';
}

export default function QuickSwitcher({
  authToken,
}: {
  authToken?: string;
}): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const client = useState(
    () => new Bloc({ auth: authToken ?? devBearer(), baseUrl: API_BASE }),
  )[0];

  // Global Cmd+K / Ctrl+K hotkey.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Focus input on open.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  // Debounce the query.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 180);
    return () => clearTimeout(t);
  }, [query]);

  // Run the search when the debounced query changes (and the switcher is open).
  const runSearch = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const response = await client.search({ query: debounced, page_size: 25 });
      const mapped: SearchResult[] = response.results.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          id: String(r['id'] ?? ''),
          object: String(r['object'] ?? 'page'),
          url:
            typeof r['url'] === 'string' ? (r['url'] as string) : `/page/${String(r['id'] ?? '')}`,
          title: deriveTitle(r),
        };
      });
      setResults(mapped);
      setActiveIdx(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [client, debounced, open]);

  useEffect(() => {
    void runSearch();
  }, [runSearch]);

  // Keyboard navigation inside the switcher.
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(results.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const target = results[activeIdx];
        if (target !== undefined) {
          window.location.href = target.url;
          setOpen(false);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, activeIdx, results]);

  const renderedResults = useMemo(() => results, [results]);

  if (!open) return null;

  return (
    <div className="qs__scrim">
      <button
        type="button"
        className="qs__scrim-dismiss"
        aria-label="Dismiss quick switcher"
        onClick={() => setOpen(false)}
      />
      <section className="qs" aria-label="Quick switcher">
        <input
          ref={inputRef}
          className="qs__input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search pages, databases…"
          aria-label="Search"
        />
        <div className="qs__hint">
          <kbd>↑↓</kbd> to navigate · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> to close
        </div>
        {loading ? (
          <p className="qs__empty">Searching…</p>
        ) : renderedResults.length === 0 ? (
          <p className="qs__empty">No matching results.</p>
        ) : (
          <nav className="qs__results" aria-label="Search results">
            {renderedResults.map((r, i) => (
              <a
                key={r.id}
                href={r.url}
                className={`qs__result ${i === activeIdx ? 'is-active' : ''}`}
                onMouseEnter={() => setActiveIdx(i)}
              >
                <span className="qs__icon" aria-hidden>
                  {r.object === 'database' ? '⌗' : '📄'}
                </span>
                <span className="qs__title">{r.title}</span>
                <span className="qs__kind">{r.object}</span>
              </a>
            ))}
          </nav>
        )}
      </section>
    </div>
  );
}
