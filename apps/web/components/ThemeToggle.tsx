'use client';

import type React from 'react';
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'bloc-theme';

function readInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage may be unavailable in private/incognito mode.
  }
  try {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {
    // matchMedia may not exist in old browsers.
  }
  return 'light';
}

export default function ThemeToggle(): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = readInitialTheme();
    setTheme(t);
    document.documentElement.dataset['theme'] = t;
    setMounted(true);
  }, []);

  function toggle(): void {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.dataset['theme'] = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage may be unavailable in private mode.
    }
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={
        mounted ? `Switch to ${theme === 'light' ? 'dark' : 'light'} theme` : 'Theme toggle'
      }
      title={mounted ? `Switch to ${theme === 'light' ? 'dark' : 'light'} theme` : 'Theme toggle'}
    >
      {mounted ? (theme === 'light' ? '☾' : '☀') : '◐'}
    </button>
  );
}
