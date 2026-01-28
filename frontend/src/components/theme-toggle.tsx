import { useEffect, useState } from 'react';

const STORAGE_KEY = 'crm-theme';

function getTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem(STORAGE_KEY) as 'dark' | 'light' | null;
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: 'dark' | 'light') {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /**/
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => getTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      className="rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
      aria-label={theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}

export function initTheme() {
  applyTheme(getTheme());
}
