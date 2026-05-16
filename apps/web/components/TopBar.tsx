'use client';

import type React from 'react';
import { useState } from 'react';
import SharingDialog from './SharingDialog.tsx';
import ThemeToggle from './ThemeToggle.tsx';
import VersionHistoryDrawer from './VersionHistoryDrawer.tsx';

export default function TopBar(): React.JSX.Element {
  const [shareOpen, setShareOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  return (
    <>
      <header className="topbar" aria-label="Top bar">
        <nav className="topbar__breadcrumb" aria-label="Breadcrumb">
          <a className="topbar__crumb" href="/">
            Acme
          </a>
          <span className="topbar__sep">/</span>
          <span className="topbar__crumb topbar__crumb--current">Untitled</span>
        </nav>
        <div className="topbar__spacer" />
        <button type="button" className="topbar__button" onClick={() => setShareOpen(true)}>
          Share
        </button>
        <ThemeToggle />
        <button type="button" className="topbar__icon" aria-label="Comments">
          💬
        </button>
        <button type="button" className="topbar__icon" aria-label="Updates">
          🔔
        </button>
        <button type="button" className="topbar__icon" aria-label="Favourite">
          ☆
        </button>
        <button
          type="button"
          className="topbar__icon"
          aria-label="Version history"
          title="Version history"
          onClick={() => setVersionsOpen(true)}
        >
          ⋯
        </button>
      </header>
      {shareOpen && <SharingDialog onClose={() => setShareOpen(false)} />}
      {versionsOpen && (
        <VersionHistoryDrawer
          pageId="00000000-0000-0000-0000-000000000003"
          onClose={() => setVersionsOpen(false)}
        />
      )}
    </>
  );
}
