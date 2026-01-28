import { Outlet, useParams, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ThemeToggle } from '../components/theme-toggle';
import { sidebarItemClassName } from '../components/ui/glass';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'داشبورد', href: 'dashboard' },
  { id: 'contacts', label: 'مخاطبین', href: 'contacts' },
  { id: 'companies', label: 'شرکت‌ها', href: 'companies' },
  { id: 'deals', label: 'معاملات', href: 'deals' },
  { id: 'tasks', label: 'کارها', href: 'tasks' },
  { id: 'activity', label: 'فعالیت', href: 'activity' },
  { id: 'import', label: 'ورود داده', href: 'import' },
  { id: 'settings', label: 'تنظیمات', href: 'settings' },
];

const STORAGE_KEY = 'sidebar.collapsed';

export default function AppLayout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const location = useLocation();
  const base = `/t/${tenantSlug}/app`;
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      /**/
    }
  }, [collapsed]);

  const currentPath = location.pathname;

  return (
    <div className="aurora-bg min-h-screen flex bg-background text-foreground">
      <aside
        className={`app-shell-sidebar glass-panel fixed inset-y-0 end-0 z-30 flex flex-col mx-4 my-4 bottom-4 top-4 rounded-panel ${
          collapsed ? 'collapsed' : ''
        }`}
      >
        <div className="flex h-14 items-center justify-between pe-3 ps-3 border-b border-white/10">
          {!collapsed && (
            <Link to={base} className="font-semibold text-foreground text-title">
              Sakhtar CRM
            </Link>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="p-2 rounded-xl hover:bg-white/5 text-foreground"
            aria-label={collapsed ? 'باز کردن منو' : 'بستن منو'}
          >
            <span className="text-lg">{collapsed ? '→' : '←'}</span>
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {NAV_ITEMS.map((item) => {
            const href = `${base}/${item.href}`;
            const active =
              currentPath === href || (item.href === 'dashboard' && (currentPath === base || currentPath === `${base}/`));
            return (
              <Link
                key={item.id}
                to={href}
                className={sidebarItemClassName(active)}
              >
                <span className="w-5 h-5 flex items-center justify-center text-muted-foreground shrink-0">●</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main
        className="flex-1 flex flex-col min-w-0 ms-0"
        style={{ marginInlineEnd: collapsed ? 80 + 32 : 280 + 32 }}
      >
        <header className="sticky top-0 z-20 h-16 border-b border-border/80 bg-background/80 backdrop-blur-xl flex items-center justify-between ps-4 pe-4 gap-4">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="p-2 rounded-xl lg:hidden hover:bg-white/5"
          >
            منو
          </button>
          <div className="flex-1 max-w-xl">
            <input
              type="search"
              placeholder="جستجو..."
              className="w-full rounded-xl border border-input bg-card/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span className="text-sm text-muted-foreground">{tenantSlug}</span>
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-medium text-primary">
              پ
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-6 max-w-data mx-auto w-full gap-4 md:gap-5">
          <Outlet />
        </div>
      </main>
    </div>
  );