'use client';

import type React from 'react';
import { useState } from 'react';

interface Comment {
  id: string;
  author: string;
  avatar: string;
  ts: string;
  body: string;
}

const SAMPLE: Comment[] = [
  {
    id: 'c1',
    author: 'Alice',
    avatar: 'A',
    ts: '2h ago',
    body: 'Should we push this to next week?',
  },
  {
    id: 'c2',
    author: 'Bob',
    avatar: 'B',
    ts: '1h ago',
    body: 'Yes — let me know if you need help.',
  },
];

export default function CommentsThread(): React.JSX.Element {
  const [comments, setComments] = useState<Comment[]>(SAMPLE);
  const [draft, setDraft] = useState('');
  function submit(): void {
    const trimmed = draft.trim();
    if (trimmed.length === 0) return;
    setComments((curr) => [
      ...curr,
      {
        id: `c-${curr.length + 1}`,
        author: 'You',
        avatar: 'Y',
        ts: 'just now',
        body: trimmed,
      },
    ]);
    setDraft('');
  }
  return (
    <section className="thread" aria-label="Comments thread">
      <ol className="thread__list">
        {comments.map((c) => (
          <li key={c.id} className="thread__comment">
            <span className="thread__avatar" aria-hidden>
              {c.avatar}
            </span>
            <div className="thread__body">
              <header className="thread__head">
                <strong>{c.author}</strong>
                <span className="thread__ts">{c.ts}</span>
              </header>
              <p>{c.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <form
        className="thread__composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          className="thread__input"
          placeholder="Add a comment…"
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Comment"
        />
        <button type="submit" className="thread__send">
          Send
        </button>
      </form>
    </section>
  );
}
