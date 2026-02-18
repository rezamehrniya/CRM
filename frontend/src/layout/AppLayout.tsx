import { Outlet, useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Users,
  UserCog,
  Building2,
  HandCoins,
  Target,
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
  { id: 'leads', label: 'لیدها', href: 'leads', Icon: Target },
  { id: 'tasks', label: 'کارها', href: 'tasks', Icon: CheckSquare },
  { id: 'activity', label: 'فعالیت', href: 'activity', Icon: Activity },
  { id: 'import', label: 'ورود داده', href: 'import', Icon: Upload },
  { id: 'members', label: 'مدیریت اعضا', href: 'members', Icon: UserCog, adminOnly: true },
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
    const isProfile = path === `${base}/profile`;
    const isSettings = path === `${base}/settings` || path.endsWith('/settings');
    const isMembers = path === `${base}/members`;
    if ((isSettings || isMembers) && !isAdmin) {
      navigate(`${base}/error?code=403`, { replace: true });
      return;
    }
    if (tenantSlug === 'demo' && !user) {
      navigate(`${base}/login`, { replace: true });
      return;
    }
    if (user && user.profileComplete === false && !isProfile) {
      navigate(`${base}/profile?complete=1`, { replace: true });
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

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

      {/* سایدبار: پس‌زمینه #122A58، متن و آیکن سفید */}
      <aside
        className={`
          app-shell-sidebar
          ${collapsed ? 'collapsed' : ''}
          fixed inset-y-0 start-0 z-30 flex flex-col
          bg-[#122A58]
          border-e border-white/15
          transition-[width,transform] duration-200 ease-out
          lg:!translate-x-0
          ${mobileMenuOpen ? '!translate-x-0' : 'translate-x-full lg:!translate-x-0'}
        `}
      >
        {/* نوار عنوان سایدبار: لوگو + ساختار */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-white/15 px-3 bg-[#122A58]">
          {!collapsed && (
            <Link to={base} className="flex items-center gap-2 min-w-0">
              <img
                src="/whitelogo.png"
                alt="ساختار"
                className="h-9 w-9 object-contain shrink-0"
              />
              <span className="text-xl font-bold text-white truncate">ساختار</span>
            </Link>
          )}
          {collapsed && (
            <Link to={base} className="flex items-center justify-center w-full py-2">
              <img src="/whitelogo.png" alt="ساختار" className="h-8 w-8 object-contain" />
            </Link>
          )}
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-md text-white/80 hover:bg-white/10 hover:text-white lg:hidden transition-colors"
              aria-label="بستن منو"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
        </div>

        {/* ناو: آیتم‌ها با متن و آیکن سفید */}
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
                  className="size-5 shrink-0 text-white"
                  aria-hidden
                />
                {!collapsed && (
                  <span className="text-sm font-medium truncate text-white">{item.label}</span>
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
                  text-white transition-colors
                  hover:bg-white/10
                  ${active ? 'bg-white/15 border-e-2 border-white text-white' : ''}
                  ${collapsed ? 'justify-center' : ''}
                `}
              >
                {content}
              </Link>
            );
          })}
        </nav>

        {/* پایین سایدبار: دکمه جمع/باز کردن — سمت چپ، آیکن برگردانده‌شده */}
        <div className="shrink-0 border-t border-white/15 p-2 flex justify-end bg-[#122A58]">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="p-2 rounded-md text-white/80 hover:bg-white/10 hover:text-white hidden lg:flex transition-colors [&_svg]:scale-x-[-1]"
            aria-label={collapsed ? 'باز کردن منو' : 'جمع کردن منو'}
          >
            {collapsed ? (
              <PanelLeft className="size-5" aria-hidden />
            ) : (
              <PanelLeftClose className="size-5" aria-hidden />
            )}
          </button>
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
          <div className="flex-1 min-w-0" />
          <ThemeToggle />
          <div className="relative flex items-center shrink-0" ref={userMenuRef}>
            {user && (
              <button
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center gap-2 flex-row-reverse rounded-xl p-1.5 pl-2 hover:bg-[var(--bg-muted)] transition-colors"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                aria-label="منوی کاربر"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover border border-primary/25 shrink-0"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-xs font-medium text-primary shrink-0"
                    title={role === 'OWNER' ? 'مدیر' : 'فروشنده'}
                  >
                    {([user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.displayName || (user.email?.[0] ?? user.phone?.[0] ?? 'پ')).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="hidden md:flex flex-col items-start min-w-0 max-w-[140px]">
                  <span className="text-sm font-medium text-foreground truncate w-full text-start">
                    {[user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.displayName || (user.email ? user.email.split('@')[0].replace(/^./, (c) => c.toUpperCase()) : user.phone ?? 'کاربر')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {role === 'OWNER' ? 'مدیر' : 'فروشنده'}
                  </span>
                </div>
              </button>
            )}
            {userMenuOpen && user && (
              <div
                className="absolute top-full end-0 mt-1 min-w-[160px] rounded-xl border border-[var(--border-default)] bg-[var(--bg-default)] shadow-lg py-1 z-50"
                role="menu"
              >
                <Link
                  to={`${base}/profile`}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-[var(--bg-muted)] transition-colors"
                  role="menuitem"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <Settings className="size-4 shrink-0 text-muted-foreground" />
                  پروفایل
                </Link>
                <button
                  type="button"
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-[var(--bg-muted)] transition-colors text-start"
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                >
                  <LogOut className="size-4 shrink-0 text-muted-foreground" />
                  خروج
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
