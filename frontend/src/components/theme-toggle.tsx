import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

const STORAGE_KEY = 'crm-theme';

function getTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem(STORAGE_KEY) as 'dark' | 'light' | null;
  if (saved === 'dark' || saved === 'light') return saved;
  return 'light';
}

function applyTheme(theme: 'dark' | 'light') {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.setAttribute('data-theme', theme);
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
      className="rounded-md p-2 text-muted-foreground hover:bg-[var(--bg-muted)] hover:text-foreground transition-colors"
      aria-label={theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'}
    >
      {theme === 'dark' ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
    </button>
  );
}

export function initTheme() {
  applyTheme(getTheme());
}
