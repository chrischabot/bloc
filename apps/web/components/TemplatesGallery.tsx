'use client';

import type React from 'react';
import { useState } from 'react';
import { useBloc } from '../lib/use-bloc.ts';

interface Template {
  id: string;
  title: string;
  category: 'Personal' | 'Work' | 'Engineering' | 'Education';
  icon: string;
  description: string;
  blocks: Array<{ type: string; [key: string]: unknown }>;
}

const TEMPLATES: Template[] = [
  {
    id: 'tpl-daily',
    title: 'Daily journal',
    category: 'Personal',
    icon: '📓',
    description: 'Track what you did, learned, and want to do next.',
    blocks: [
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: "Today's intent", link: null } }],
          color: 'default',
        },
      },
      {
        type: 'paragraph',
        paragraph: { rich_text: [], color: 'default' },
      },
    ],
  },
  {
    id: 'tpl-meeting',
    title: 'Meeting notes',
    category: 'Work',
    icon: '🗒',
    description: 'Capture attendees, agenda, decisions, and action items.',
    blocks: [
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Attendees', link: null } }],
          color: 'default',
        },
      },
      {
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: [], color: 'default' },
      },
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Decisions', link: null } }],
          color: 'default',
        },
      },
      {
        type: 'paragraph',
        paragraph: { rich_text: [], color: 'default' },
      },
    ],
  },
  {
    id: 'tpl-design-doc',
    title: 'Engineering design doc',
    category: 'Engineering',
    icon: '🛠',
    description: 'Problem → goals → design → risks → milestones.',
    blocks: [
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Problem', link: null } }],
          color: 'default',
        },
      },
      { type: 'paragraph', paragraph: { rich_text: [], color: 'default' } },
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Goals', link: null } }],
          color: 'default',
        },
      },
      { type: 'paragraph', paragraph: { rich_text: [], color: 'default' } },
    ],
  },
  {
    id: 'tpl-class',
    title: 'Class notes',
    category: 'Education',
    icon: '📚',
    description: 'Lecture, vocabulary, key examples, follow-up reading.',
    blocks: [
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Lecture summary', link: null } }],
          color: 'default',
        },
      },
      { type: 'paragraph', paragraph: { rich_text: [], color: 'default' } },
    ],
  },
];

interface Props {
  onClose: () => void;
}

export default function TemplatesGallery({ onClose }: Props): React.JSX.Element {
  const { client } = useBloc();
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);

  async function create(t: Template): Promise<void> {
    if (client === null) return;
    setCreating(t.id);
    setError(null);
    try {
      const titleBlock = {
        type: 'heading_1',
        heading_1: {
          rich_text: [{ type: 'text', text: { content: t.title, link: null } }],
          color: 'default',
        },
      };
      const page = await client.pages.create({
        parent: { type: 'workspace', workspace: true },
        icon: { type: 'emoji', emoji: t.icon },
        children: [titleBlock, ...t.blocks],
      });
      onClose();
      window.location.href = `/page/${page.id}`;
    } catch (err) {
      setError((err as Error).message);
      setCreating(null);
    }
  }

  const byCategory = new Map<string, Template[]>();
  for (const t of TEMPLATES) {
    const arr = byCategory.get(t.category) ?? [];
    arr.push(t);
    byCategory.set(t.category, arr);
  }

  return (
    <div className="templates__scrim">
      <button
        type="button"
        className="templates__scrim-dismiss"
        aria-label="Dismiss templates gallery"
        onClick={onClose}
      />
      <section className="templates" aria-label="Templates gallery">
        <header className="templates__header">
          <h2>Templates</h2>
          <button type="button" className="templates__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {error !== null && <p className="templates__error">{error}</p>}
        <div className="templates__body">
          {Array.from(byCategory.entries()).map(([category, list]) => (
            <section key={category} className="templates__category">
              <h3>{category}</h3>
              <div className="templates__grid">
                {list.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="templates__card"
                    onClick={() => void create(t)}
                    disabled={creating !== null || client === null}
                  >
                    <span className="templates__icon" aria-hidden>
                      {t.icon}
                    </span>
                    <span className="templates__title">{t.title}</span>
                    <span className="templates__description">{t.description}</span>
                    {creating === t.id && <span className="templates__status">Creating…</span>}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}