'use client';

import type React from 'react';
import { useState } from 'react';
import PermissionsPanel from './PermissionsPanel';
import SharingDialog from './SharingDialog';

interface Props {
  pageId: string;
  title: string;
  icon?: string | null;
  cover?: string | null;
  isDatabaseRow?: boolean;
  properties?: { name: string; value: string }[];
}

export default function PageHeader(props: Props): React.JSX.Element {
  const [titleDraft, setTitleDraft] = useState(props.title);
  const [shareOpen, setShareOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);

  return (
    <header className="pageheader">
      {props.cover ? (
        <div className="pageheader__cover">
          <img src={props.cover} alt="Page cover" />
          <div className="pageheader__cover-actions">
            <button type="button" className="pageheader__cover-btn">
              Change cover
            </button>
            <button type="button" className="pageheader__cover-btn">
              Reposition
            </button>
            <button type="button" className="pageheader__cover-btn">
              Remove
            </button>
          </div>
        </div>
      ) : null}

      <div className={`pageheader__body ${props.cover ? 'has-cover' : ''}`}>
        <div className="pageheader__iconrow">
          <button type="button" className="pageheader__icon" aria-label="Change icon">
            {props.icon ?? '📄'}
          </button>
          <div className="pageheader__actions">
            {!props.cover && (
              <button type="button" className="pageheader__action">
                Add cover
              </button>
            )}
            {!props.icon && (
              <button type="button" className="pageheader__action">
                Add icon
              </button>
            )}
            <button type="button" className="pageheader__action">
              Add comment
            </button>
          </div>
        </div>

        <input
          className="pageheader__title"
          type="text"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          placeholder="Untitled"
          aria-label="Page title"
        />

        {props.isDatabaseRow && props.properties && props.properties.length > 0 && (
          <dl className="pageheader__props">
            {props.properties.map((p) => (
              <div key={p.name} className="pageheader__prop">
                <dt className="pageheader__prop-name">{p.name}</dt>
                <dd className="pageheader__prop-value">{p.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <nav className="pageheader__bar" aria-label="Page actions">
          <button type="button" className="pageheader__bar-btn" onClick={() => setShareOpen(true)}>
            Share
          </button>
          <button
            type="button"
            className="pageheader__bar-btn"
            onClick={() => setPermissionsOpen((v) => !v)}
            aria-pressed={permissionsOpen}
          >
            {permissionsOpen ? 'Hide permissions' : 'Show permissions'}
          </button>
        </nav>

        {permissionsOpen && <PermissionsPanel pageId={props.pageId} />}
      </div>

      {shareOpen && <SharingDialog onClose={() => setShareOpen(false)} />}
    </header>
  );
}
