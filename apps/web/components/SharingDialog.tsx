'use client';

import type React from 'react';
import { useState } from 'react';

type Role = 'full_access' | 'can_edit' | 'can_comment' | 'can_read';

interface Share {
  id: string;
  name: string;
  email: string;
  role: Role;
}

const ROLE_LABEL: Record<Role, string> = {
  full_access: 'Full access',
  can_edit: 'Can edit',
  can_comment: 'Can comment',
  can_read: 'Can view',
};

const INITIAL_SHARES: Share[] = [
  { id: '1', name: 'You', email: 'you@example.com', role: 'full_access' },
];

export default function SharingDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [tab, setTab] = useState<'share' | 'publish'>('share');
  const [shares, setShares] = useState<Share[]>(INITIAL_SHARES);
  const [invite, setInvite] = useState('');
  const [publishOn, setPublishOn] = useState(false);

  function addShare(): void {
    const trimmed = invite.trim();
    if (trimmed.length === 0 || !trimmed.includes('@')) return;
    setShares((curr) => [
      ...curr,
      {
        id: `g-${curr.length + 1}`,
        name: trimmed.split('@')[0] ?? trimmed,
        email: trimmed,
        role: 'can_edit',
      },
    ]);
    setInvite('');
  }

  function setShareRole(id: string, role: Role): void {
    setShares((curr) => curr.map((s) => (s.id === id ? { ...s, role } : s)));
  }

  function removeShare(id: string): void {
    setShares((curr) => curr.filter((s) => s.id !== id));
  }

  return (
    <div className="dialog__scrim">
      <button
        type="button"
        className="dialog__scrim-close"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <dialog open className="dialog" aria-label="Share">
        <div className="dialog__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'share'}
            className={`dialog__tab ${tab === 'share' ? 'is-active' : ''}`}
            onClick={() => setTab('share')}
          >
            Share
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'publish'}
            className={`dialog__tab ${tab === 'publish' ? 'is-active' : ''}`}
            onClick={() => setTab('publish')}
          >
            Publish
          </button>
        </div>

        {tab === 'share' && (
          <div className="dialog__body">
            <div className="dialog__invite">
              <input
                type="email"
                placeholder="Email or name"
                value={invite}
                onChange={(e) => setInvite(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addShare()}
                aria-label="Invite"
              />
              <button type="button" className="dialog__cta" onClick={addShare}>
                Invite
              </button>
            </div>
            <ul className="dialog__list">
              {shares.map((s) => (
                <li key={s.id} className="dialog__row">
                  <span className="dialog__avatar" aria-hidden>
                    {s.name[0]?.toUpperCase() ?? '·'}
                  </span>
                  <span className="dialog__who">
                    <span className="dialog__name">{s.name}</span>
                    <span className="dialog__email">{s.email}</span>
                  </span>
                  <select
                    className="dialog__role"
                    value={s.role}
                    onChange={(e) => setShareRole(s.id, e.target.value as Role)}
                    aria-label={`Role for ${s.name}`}
                  >
                    {Object.entries(ROLE_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  {s.id !== '1' && (
                    <button
                      type="button"
                      className="dialog__remove"
                      onClick={() => removeShare(s.id)}
                      aria-label={`Remove ${s.name}`}
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'publish' && (
          <div className="dialog__body">
            <label className="dialog__toggle">
              <input
                type="checkbox"
                checked={publishOn}
                onChange={(e) => setPublishOn(e.target.checked)}
              />
              <span>Publish to web</span>
            </label>
            {publishOn && (
              <div className="dialog__url">
                <input
                  readOnly
                  value="https://acme.notion.site/welcome-abc12345"
                  aria-label="Public URL"
                />
                <button type="button" className="dialog__cta">
                  Copy
                </button>
              </div>
            )}
            <p className="dialog__hint">
              When published, anyone with the link can view the page. Visit Settings to configure
              search engine indexing.
            </p>
          </div>
        )}

        <div className="dialog__footer">
          <button type="button" className="dialog__cta" onClick={onClose}>
            Done
          </button>
        </div>
      </dialog>
    </div>
  );
}
