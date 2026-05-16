'use client';

import { useState } from 'react';

type Section = 'account' | 'workspace' | 'appearance' | 'integrations';

const LABELS: Record<Section, string> = {
  account: 'My account',
  workspace: 'Workspace',
  appearance: 'Appearance',
  integrations: 'My integrations',
};

export default function SettingsPage(): React.JSX.Element {
  const [section, setSection] = useState<Section>('account');
  return (
    <article className="editor">
      <header className="editor__header">
        <h1 className="editor__title">Settings</h1>
      </header>
      <section className="settings">
        <nav className="settings__nav" aria-label="Settings sections">
          <ul>
            {(Object.keys(LABELS) as Section[]).map((s) => (
              <li key={s}>
                <button
                  type="button"
                  className={`settings__nav-item ${section === s ? 'is-active' : ''}`}
                  onClick={() => setSection(s)}
                >
                  {LABELS[s]}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="settings__pane">
          {section === 'account' && (
            <div className="settings__form">
              <h2>Account</h2>
              <label>
                Display name
                <input defaultValue="Alice" />
              </label>
              <label>
                Email
                <input defaultValue="alice@example.com" readOnly />
              </label>
              <button type="button" className="settings__cta">
                Save
              </button>
            </div>
          )}
          {section === 'workspace' && (
            <div className="settings__form">
              <h2>Workspace</h2>
              <label>
                Workspace name
                <input defaultValue="Acme" />
              </label>
              <label>
                Plan
                <select defaultValue="business">
                  <option value="free">Free</option>
                  <option value="plus">Plus</option>
                  <option value="business">Business</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </label>
              <button type="button" className="settings__cta">
                Save
              </button>
            </div>
          )}
          {section === 'appearance' && (
            <div className="settings__form">
              <h2>Appearance</h2>
              <label>
                Theme
                <select defaultValue="system">
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
              <label>
                Density
                <select defaultValue="comfortable">
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </label>
            </div>
          )}
          {section === 'integrations' && (
            <div className="settings__form">
              <h2>My integrations</h2>
              <p>Create and manage internal API tokens for your workspace.</p>
              <button type="button" className="settings__cta">
                + Create integration
              </button>
            </div>
          )}
        </div>
      </section>
    </article>
  );
}
