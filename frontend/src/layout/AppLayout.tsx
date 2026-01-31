import { Outlet, useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Building2,
  HandCoins,
  CheckSquare,
  Activity,
  Upload,
  Settings,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { ThemeToggle } from '../components/theme-toggle';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/auth-context';

type NavItem = {
  id: string;
  label: string;
  href: string;
  Icon: typeof LayoutDashboard;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'داشبورد', href: 'dashboard', Icon: LayoutDashboard },
  { id: 'contacts', label: 'مخاطبین', href: 'contacts', Icon: Users },
  { id: 'companies', label: 'شرکت‌ها', href: 'companies', Icon: Building2 },
  { id: 'deals', label: 'معاملات', href: 'deals', Icon: HandCoins },
  { id: 'tasks', label: 'کارها', href: 'tasks', Icon: CheckSquare },
  { id: 'activity', label: 'فعالیت', href: 'activity', Icon: Activity },
  { id: 'import', label: 'ورود داده', href: 'import', Icon: Upload },
  { id: 'settings', label: 'تنظیمات', href: 'settings', Icon: Settings, adminOnly: true },
];

const STORAGE_KEY = 'sidebar.collapsed';

export default function AppLayout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, loading, logout } = useAuth();
  const base = `/t/${tenantSlug}/app`;
  const isAdmin = role === 'OWNER';
  const navItems = loading
    ? NAV_ITEMS
    : NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  useEffect(() => {
    if (loading) return;
    const path = location.pathname;
    const isSettings = path === `${base}/settings` || path.endsWith('/settings');
    if (isSettings && !isAdmin) {
      navigate(`${base}/error?code=403`, { replace: true });
      return;
    }
    if (tenantSlug === 'demo' && !user) {
      navigate(`${base}/login`, { replace: true });
    }
  }, [loading, isAdmin, base, location.pathname, navigate, tenantSlug, user]);

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      /**/
    }
  }, [collapsed]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const currentPath = location.pathname;

  return (
    <div className="min-h-screen flex bg-[var(--bg-default)] text-foreground">
      {/* Backdrop موبایل */}
      {mobileMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          aria-label="بستن منو"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* سایدبار: پس‌زمینهٔ سکشن‌ها از پالت Primer (--bg-subtle)، مرز از --border-default */}
      <aside
        className={`
          app-shell-sidebar
          ${collapsed ? 'collapsed' : ''}
          fixed inset-y-0 start-0 z-30 flex flex-col
          bg-[var(--bg-subtle)]
          border-e border-[var(--border-default)]
          transition-[width,transform] duration-200 ease-out
          lg:!translate-x-0
          ${mobileMenuOpen ? '!translate-x-0' : 'translate-x-full lg:!translate-x-0'}
        `}
      >
        {/* نوار عنوان سایدبار: --bg-toolbar برای نوار ابزار/عنوان */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[var(--border-default)] px-3 bg-[var(--bg-toolbar)]">
          {!collapsed && (
            <Link
              to={base}
              className="min-w-0 truncate text-sm font-semibold text-foreground"
            >
              {tenantSlug === 'demo' ? 'پنل مدیر فروش' : tenantSlug ? `سازمان: ${tenantSlug}` : 'Sakhtar CRM'}
            </Link>
          )}
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-md text-muted-foreground hover:bg-[var(--bg-muted)] hover:text-foreground lg:hidden transition-colors"
              aria-label="بستن منو"
            >
              <X className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="p-2 rounded-md text-muted-foreground hover:bg-[var(--bg-muted)] hover:text-foreground hidden lg:flex transition-colors"
              aria-label={collapsed ? 'باز کردن منو' : 'جمع کردن منو'}
            >
              {collapsed ? (
                <PanelLeft className="size-5" aria-hidden />
              ) : (
                <PanelLeftClose className="size-5" aria-hidden />
              )}
            </button>
          </div>
        </div>

        {/* ناو: آیتم‌ها با gap-2، rounded-md، hover و active */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-0.5">
          {navItems.map((item) => {
            const href = `${base}/${item.href}`;
            const active =
              currentPath === href ||
              (item.href === 'dashboard' && (currentPath === base || currentPath === `${base}/`));
            const Icon = item.Icon;
            const content = (
              <>
                <Icon
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                {!collapsed && (
                  <span className="text-sm font-medium truncate">{item.label}</span>
                )}
              </>
            );
            return (
              <Link
                key={item.id}
                to={href}
                title={collapsed ? item.label : undefined}
                className={`
                  flex items-center gap-2 rounded-md px-3 py-2
                  text-foreground transition-colors
                  hover:bg-[var(--bg-muted)]
                  ${active ? 'bg-[var(--bg-muted)] border-e-2 border-primary text-foreground' : ''}
                  ${collapsed ? 'justify-center' : ''}
                `}
              >
                {content}
              </Link>
            );
          })}
        </nav>

        {/* پایین سایدبار: ردیف پایین از --bg-muted، مرز از --border-default */}
        <div className="shrink-0 border-t border-[var(--border-default)] p-3 flex items-center gap-2 bg-[var(--bg-muted)]">
          <ThemeToggle />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={logout}
            className="flex-1 justify-center gap-2 text-muted-foreground hover:text-foreground"
            aria-label="خروج"
          >
            <LogOut className="size-5 shrink-0" aria-hidden />
            {!collapsed && <span className="text-sm font-medium">خروج</span>}
          </Button>
        </div>
      </aside>

      {/* محتوای اصلی */}
      <main className={`app-shell-main flex-1 flex flex-col min-w-0 ${collapsed ? 'collapsed' : ''}`}>
        {/* نوار عنوان/ابزار: --bg-toolbar، مرز --border-default */}
        <header className="sticky top-0 z-20 h-14 border-b border-[var(--border-default)] bg-[var(--bg-toolbar)] backdrop-blur supports-[backdrop-filter]:bg-[var(--bg-toolbar)]/95 flex items-center justify-between ps-4 pe-4 gap-4">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="p-2 rounded-md lg:hidden text-muted-foreground hover:bg-[var(--bg-muted)] hover:text-foreground transition-colors"
            aria-label="باز کردن منو"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <div className="flex-1 max-w-xl min-w-0">
            <Input
              type="search"
              placeholder="جستجو..."
              className="bg-[var(--bg-muted)]/60 border-[var(--border-default)] text-sm"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-muted-foreground hidden sm:inline truncate max-w-[140px]" title={tenantSlug === 'demo' ? 'پنل مدیر فروش (دمو)' : tenantSlug}>
              {tenantSlug === 'demo' ? 'پنل مدیر فروش' : tenantSlug}
            </span>
            {user && (
              <span
                className="text-sm text-muted-foreground hidden md:inline truncate max-w-[140px]"
                title={user.email ?? user.phone ?? undefined}
              >
                {user.email ?? user.phone ?? 'کاربر'}
              </span>
            )}
            <div
              className="w-8 h-8 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-xs font-medium text-primary shrink-0"
              title={role === 'OWNER' ? 'مدیر' : 'فروشنده'}
            >
              {(user?.email?.[0] ?? user?.phone?.[0] ?? 'پ').toUpperCase()}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
