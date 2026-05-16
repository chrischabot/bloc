'use client';

import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface SlashItem {
  id: string;
  label: string;
  hint: string;
  icon: string;
  keywords: string[];
  section: 'Basic blocks' | 'Media' | 'Embeds' | 'Inline' | 'Advanced' | 'Database';
}

export const SLASH_ITEMS: SlashItem[] = [
  {
    id: 'paragraph',
    label: 'Text',
    hint: 'Just start writing',
    icon: 'T',
    keywords: ['text', 'paragraph', 'p'],
    section: 'Basic blocks',
  },
  {
    id: 'heading_1',
    label: 'Heading 1',
    hint: 'Big section heading',
    icon: 'H1',
    keywords: ['h1', '#'],
    section: 'Basic blocks',
  },
  {
    id: 'heading_2',
    label: 'Heading 2',
    hint: 'Medium section heading',
    icon: 'H2',
    keywords: ['h2', '##'],
    section: 'Basic blocks',
  },
  {
    id: 'heading_3',
    label: 'Heading 3',
    hint: 'Small section heading',
    icon: 'H3',
    keywords: ['h3', '###'],
    section: 'Basic blocks',
  },
  {
    id: 'bulleted_list_item',
    label: 'Bulleted list',
    hint: 'Simple bulleted list',
    icon: '•',
    keywords: ['bullet', 'ul', '-'],
    section: 'Basic blocks',
  },
  {
    id: 'numbered_list_item',
    label: 'Numbered list',
    hint: 'Numbered list',
    icon: '1.',
    keywords: ['numbered', 'ol', '1.'],
    section: 'Basic blocks',
  },
  {
    id: 'to_do',
    label: 'To-do list',
    hint: 'Track tasks with checkboxes',
    icon: '☐',
    keywords: ['todo', 'task', 'check'],
    section: 'Basic blocks',
  },
  {
    id: 'toggle',
    label: 'Toggle list',
    hint: 'Hide content inside',
    icon: '▸',
    keywords: ['toggle', '>'],
    section: 'Basic blocks',
  },
  {
    id: 'quote',
    label: 'Quote',
    hint: 'Capture a quote',
    icon: '"',
    keywords: ['quote'],
    section: 'Basic blocks',
  },
  {
    id: 'divider',
    label: 'Divider',
    hint: 'Visually divide blocks',
    icon: '—',
    keywords: ['divider', '---'],
    section: 'Basic blocks',
  },
  {
    id: 'callout',
    label: 'Callout',
    hint: 'Stand-out highlighted text',
    icon: '💡',
    keywords: ['callout', 'info'],
    section: 'Basic blocks',
  },
  {
    id: 'code',
    label: 'Code',
    hint: 'Code block with syntax highlight',
    icon: '</>',
    keywords: ['code', '```'],
    section: 'Basic blocks',
  },
  {
    id: 'equation',
    label: 'Equation',
    hint: 'TeX-style math',
    icon: '∑',
    keywords: ['math', 'latex', 'equation'],
    section: 'Basic blocks',
  },
  {
    id: 'image',
    label: 'Image',
    hint: 'Upload or embed an image',
    icon: '🖼',
    keywords: ['image', 'picture'],
    section: 'Media',
  },
  {
    id: 'video',
    label: 'Video',
    hint: 'Embed a video',
    icon: '🎬',
    keywords: ['video'],
    section: 'Media',
  },
  {
    id: 'file',
    label: 'File',
    hint: 'Upload a file',
    icon: '📎',
    keywords: ['file'],
    section: 'Media',
  },
  { id: 'pdf', label: 'PDF', hint: 'Embed a PDF', icon: '📕', keywords: ['pdf'], section: 'Media' },
  {
    id: 'bookmark',
    label: 'Bookmark',
    hint: 'Save a link as a visual bookmark',
    icon: '🔖',
    keywords: ['bookmark'],
    section: 'Embeds',
  },
  {
    id: 'embed',
    label: 'Embed',
    hint: 'Embed any web content',
    icon: '🔗',
    keywords: ['embed', 'iframe'],
    section: 'Embeds',
  },
  {
    id: 'table_of_contents',
    label: 'Table of contents',
    hint: 'Auto-link to headings',
    icon: '☰',
    keywords: ['toc'],
    section: 'Advanced',
  },
  {
    id: 'breadcrumb',
    label: 'Breadcrumb',
    hint: 'Show ancestor chain',
    icon: '›',
    keywords: ['breadcrumb'],
    section: 'Advanced',
  },
  {
    id: 'columns',
    label: 'Columns',
    hint: 'Side-by-side layout',
    icon: '◫',
    keywords: ['columns', 'layout'],
    section: 'Advanced',
  },
  {
    id: 'synced_block',
    label: 'Synced block',
    hint: 'Reuse content across pages',
    icon: '🔄',
    keywords: ['sync'],
    section: 'Advanced',
  },
  {
    id: 'mention',
    label: 'Mention a page or person',
    hint: 'Inline reference',
    icon: '@',
    keywords: ['@', 'mention'],
    section: 'Inline',
  },
  {
    id: 'date',
    label: 'Date or reminder',
    hint: 'Pick a date',
    icon: '📅',
    keywords: ['date', 'today'],
    section: 'Inline',
  },
  {
    id: 'database_inline',
    label: 'Database — inline',
    hint: 'Add a database here',
    icon: '⌗',
    keywords: ['db', 'database'],
    section: 'Database',
  },
  {
    id: 'database_full',
    label: 'Database — full page',
    hint: 'New full-page database',
    icon: '⌗',
    keywords: ['db', 'database'],
    section: 'Database',
  },
];

function filterItems(items: SlashItem[], query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return items;
  return items.filter(
    (i) => i.label.toLowerCase().includes(q) || i.keywords.some((k) => k.toLowerCase().includes(q)),
  );
}

function groupBySection(items: SlashItem[]): { section: string; items: SlashItem[] }[] {
  const map = new Map<string, SlashItem[]>();
  for (const item of items) {
    const arr = map.get(item.section) ?? [];
    arr.push(item);
    map.set(item.section, arr);
  }
  return Array.from(map.entries()).map(([section, list]) => ({ section, items: list }));
}

export default function SlashMenu({
  open,
  query,
  onSelect,
  onClose,
}: {
  open: boolean;
  query: string;
  onSelect: (blockType: string) => void;
  onClose: () => void;
}): React.JSX.Element | null {
  const [activeIdx, setActiveIdx] = useState(0);
  const items = useMemo(() => filterItems(SLASH_ITEMS, query), [query]);
  const containerRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only on query change
  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function handle(e: KeyboardEvent): void {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(items.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const target = items[activeIdx];
        if (target !== undefined) onSelect(target.id);
      } else if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [open, items, activeIdx, onSelect, onClose]);

  if (!open) return null;
  const grouped = groupBySection(items);

  return (
    <nav ref={containerRef} className="slashmenu" aria-label="Slash command menu">
      {grouped.length === 0 ? (
        <div className="slashmenu__empty">No matching blocks</div>
      ) : (
        grouped.map((g) => (
          <div key={g.section} className="slashmenu__group">
            <div className="slashmenu__header">{g.section}</div>
            <ul className="slashmenu__items">
              {g.items.map((it) => {
                const idx = items.indexOf(it);
                const active = idx === activeIdx;
                return (
                  <li key={it.id}>
                    <button
                      type="button"
                      className={`slashmenu__item ${active ? 'is-active' : ''}`}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => onSelect(it.id)}
                      aria-pressed={active}
                    >
                      <span className="slashmenu__icon" aria-hidden>
                        {it.icon}
                      </span>
                      <span className="slashmenu__label">{it.label}</span>
                      <span className="slashmenu__hint">{it.hint}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </nav>
  );
}
