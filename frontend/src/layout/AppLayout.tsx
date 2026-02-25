import { Outlet, useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard,
  Users,
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
  Search,
  PhoneCall,
  MessageSquareText,
  CalendarDays,
  Bell,
  ListTodo,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import { apiGet, apiPatch, apiPost } from '../lib/api';
import { formatJalali } from '../lib/date';
import { formatFaNum } from '../lib/numbers';
import {
  addDays,
  addMonths,
  format as formatJalaliFns,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns-jalali';
import { faIR } from 'date-fns-jalali/locale/fa-IR';

type NavItem = {
  id: string;
  label: string;
  href: string;
  Icon: typeof LayoutDashboard;
  requirePermissions?: string[];
  requireAnyPermissions?: string[];
};

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'داشبورد', href: 'dashboard', Icon: LayoutDashboard, requirePermissions: ['dashboard.read'] },
  { id: 'contacts', label: 'مخاطبین', href: 'contacts', Icon: Users, requirePermissions: ['contacts.read'] },
  { id: 'companies', label: 'شرکت‌ها', href: 'companies', Icon: Building2, requirePermissions: ['companies.read'] },
  { id: 'quotes', label: 'پیش‌فاکتور و فاکتور', href: 'quotes', Icon: HandCoins, requireAnyPermissions: ['quotes.read', 'invoices.read'] },
  { id: 'leads', label: 'لیدها', href: 'leads', Icon: Target, requirePermissions: ['leads.read'] },
  { id: 'tasks', label: 'کارها', href: 'tasks', Icon: CheckSquare, requirePermissions: ['tasks.read'] },
  { id: 'activity', label: 'فعالیت‌ها', href: 'activity', Icon: Activity, requirePermissions: ['activities.read'] },
  { id: 'calls', label: 'مرکز تماس', href: 'calls', Icon: PhoneCall, requirePermissions: ['calls.read'] },
  { id: 'sms', label: 'پنل پیامک', href: 'sms', Icon: MessageSquareText, requirePermissions: ['sms.read'] },
  { id: 'import', label: 'ورود داده', href: 'import', Icon: Upload, requirePermissions: ['imports.read'] },
  { id: 'settings', label: 'تنظیمات', href: 'settings', Icon: Settings, requirePermissions: ['settings.read'] },
];

const STORAGE_KEY = 'sidebar.collapsed';

function normalizeRole(raw?: string | null): string {
  const value = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (value === 'OWNER') return 'ADMIN';
  if (value === 'MEMBER') return 'SALES_REP';
  if (value === 'SALESREP') return 'SALES_REP';
  if (value === 'SALESMANAGER') return 'SALES_MANAGER';
  return value;
}

function roleFromRoleName(raw?: string | null): string | null {
  const source = String(raw ?? '').trim();
  if (!source) return null;
  const value = source.toUpperCase();
  if (value === 'ADMIN' || value.includes('ADMIN')) return 'ADMIN';
  if (value === 'SALES_MANAGER' || value.includes('MANAGER') || source.includes('مدیر')) return 'SALES_MANAGER';
  if (value === 'SALES_REP' || value.includes('SALES REP') || value.includes('REP') || source.includes('فروش')) return 'SALES_REP';
  if (value === 'VIEWER' || value.includes('VIEWER') || source.includes('بیننده')) return 'VIEWER';
  return null;
}

type ServerTimeResponse = {
  serverNowIso: string;
  timezone: string;
  jalali: {
    pretty: string;
    date: string;
    weekday: string;
  };
};

type TodoItem = {
  id: string;
  userId: string;
  title: string;
  dueAt: string | null;
  status: 'OPEN' | 'DONE';
  createdAt: string;
  updatedAt: string;
};

type TodoListResponse = {
  scope: 'me' | 'team';
  status: 'open' | 'done' | 'all';
  limit: number;
  counts: {
    open: number;
    done: number;
    total: number;
  };
  items: TodoItem[];
};

type ReminderTaskItem = {
  id: string;
  title: string;
  dueAt: string;
  overdueDays: number;
  assignedToUserId: string | null;
  assigneeName: string;
};

type ReminderLeadItem = {
  id: string;
  name: string;
  followUpAt: string;
  overdueDays: number;
  ownerUserId: string | null;
  ownerName: string;
};

type ReminderQuoteItem = {
  id: string;
  title: string;
  companyName: string | null;
  sentAt: string;
  waitingDays: number;
  ownerUserId: string | null;
  ownerName: string;
};

type ReminderSummaryResponse = {
  scope: 'me' | 'team';
  serverNowIso: string;
  waitingResponseDays: number;
  counts: {
    overdueTasks: number;
    overdueLeads: number;
    waitingQuotes: number;
    total: number;
  };
  items: {
    tasks: ReminderTaskItem[];
    leads: ReminderLeadItem[];
    quotes: ReminderQuoteItem[];
  };
};

type TopbarCrumb = {
  label: string;
  href?: string;
};

const TOPBAR_PAGE_LABELS: Record<string, string> = {
  dashboard: 'داشبورد',
  contacts: 'مخاطبین',
  companies: 'شرکت‌ها',
  quotes: 'پیش‌فاکتور و فاکتور',
  deals: 'معاملات',
  leads: 'لیدها',
  tasks: 'کارها',
  activity: 'فعالیت‌ها',
  calls: 'مرکز تماس',
  sms: 'پنل پیامک',
  import: 'ورود داده',
  settings: 'تنظیمات',
  members: 'اعضا',
  profile: 'پروفایل',
  error: 'خطا',
};

const TOPBAR_SETTING_LABELS: Record<string, string> = {
  billing: 'اشتراک و صورت‌حساب',
  pipeline: 'پایپ‌لاین فروش',
  users: 'کاربران',
  'lead-sources': 'منابع لید',
};

const WEEKDAY_LABELS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function resolveTopbarMeta(pathname: string, base: string): { title: string; crumbs: TopbarCrumb[] } {
  const safeBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const rel = pathname.startsWith(safeBase)
    ? pathname.slice(safeBase.length)
    : pathname;
  const segments = rel.split('/').filter(Boolean);
  const crumbs: TopbarCrumb[] = [{ label: 'پنل', href: safeBase }];

  if (segments.length === 0 || segments[0] === 'dashboard') {
    return { title: 'داشبورد', crumbs };
  }

  const section = segments[0];
  const sectionLabel = TOPBAR_PAGE_LABELS[section] ?? section;
  crumbs.push({ label: sectionLabel, href: `${safeBase}/${section}` });

  if (section === 'settings' && segments[1]) {
    const settingLabel = TOPBAR_SETTING_LABELS[segments[1]] ?? 'جزئیات تنظیمات';
    crumbs.push({ label: settingLabel });
    return { title: settingLabel, crumbs };
  }

  if (section === 'error') {
    return { title: 'خطا', crumbs };
  }

  if (segments.length > 1) {
    crumbs.push({ label: 'جزئیات' });
    return { title: 'جزئیات', crumbs };
  }

  return { title: sectionLabel, crumbs };
}

function formatServerClock(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('fa-IR', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatPickerDate(date: Date | null): string {
  if (!date) return '—';
  return formatJalaliFns(date, 'yyyy/MM/dd', { locale: faIR });
}

function formatRelativeDays(days: number): string {
  return `${formatFaNum(days)} روز`;
}

function startOfTomorrow(baseIso?: string): string {
  const base = baseIso ? new Date(baseIso) : new Date();
  const next = new Date(base.getTime() + ONE_DAY_MS);
  return next.toISOString();
}

export default function AppLayout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, roleName, loading, logout, hasPermission } = useAuth();
  const base = `/t/${tenantSlug}/app`;
  const normalizedRole = normalizeRole(role ?? roleFromRoleName(roleName) ?? null);
  const resolvedRoleLabel =
    normalizedRole === 'ADMIN'
      ? 'مدیر سیستم'
      : normalizedRole === 'SALES_MANAGER'
        ? 'مدیر فروش'
        : normalizedRole === 'VIEWER'
          ? 'بیننده'
          : 'کارشناس فروش';
  const isDemoTenant = tenantSlug?.trim().toLowerCase() === 'demo';
  const demoSwitchTarget =
    isDemoTenant && normalizedRole === 'SALES_REP'
      ? { profile: 'manager', label: 'دموی پنل مدیر فروش' }
      : isDemoTenant && normalizedRole === 'SALES_MANAGER'
        ? { profile: 'rep', label: 'دموی پنل کارشناس فروش' }
        : null;
  const navItems = loading
    ? []
    : NAV_ITEMS.filter((item) => {
        if (normalizedRole === 'SALES_REP' && (item.id === 'import' || item.id === 'settings')) {
          return false;
        }
        if (
          (item.id === 'calls' || item.id === 'sms') &&
          (normalizedRole === 'ADMIN' || normalizedRole === 'SALES_MANAGER' || normalizedRole === 'SALES_REP')
        ) {
          return true;
        }
        const hasAll = (item.requirePermissions ?? []).every((permission) => hasPermission(permission));
        const hasAny =
          !item.requireAnyPermissions || item.requireAnyPermissions.length === 0
            ? true
            : item.requireAnyPermissions.some((permission) => hasPermission(permission));
        return hasAll && hasAny;
      });

  useEffect(() => {
    if (loading) return;
    const path = location.pathname;
    const isProfile = path === `${base}/profile`;
    const isSettings = path.startsWith(`${base}/settings`);
    const isMembers = path === `${base}/members`;
    if (isSettings && !hasPermission('settings.read')) {
      navigate(`${base}/error?code=403`, { replace: true });
      return;
    }
    if (isMembers && !hasPermission('users.read')) {
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
  }, [loading, base, hasPermission, location.pathname, navigate, tenantSlug, user]);

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

  const [commandQuery, setCommandQuery] = useState('');
  const commandInputRef = useRef<HTMLInputElement>(null);

  const [calendarOpen, setCalendarOpen] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [calendarMode, setCalendarMode] = useState<'single' | 'range'>('single');
  const [calendarSingle, setCalendarSingle] = useState<Date | null>(null);
  const [calendarRangeFrom, setCalendarRangeFrom] = useState<Date | null>(null);
  const [calendarRangeTo, setCalendarRangeTo] = useState<Date | null>(null);
  const [calendarViewMonth, setCalendarViewMonth] = useState<Date>(() => startOfMonth(new Date()));

  const [todoOpen, setTodoOpen] = useState(false);
  const todoRef = useRef<HTMLDivElement>(null);
  const [todoStatusFilter, setTodoStatusFilter] = useState<'open' | 'done' | 'all'>('open');
  const [todoData, setTodoData] = useState<TodoListResponse | null>(null);
  const [todoLoading, setTodoLoading] = useState(false);
  const [todoBusy, setTodoBusy] = useState(false);
  const [todoTitle, setTodoTitle] = useState('');

  const [remindersOpen, setRemindersOpen] = useState(false);
  const [reminderScope, setReminderScope] = useState<'me' | 'team'>('me');
  const [remindersData, setRemindersData] = useState<ReminderSummaryResponse | null>(null);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [remindersBusyKey, setRemindersBusyKey] = useState<string | null>(null);

  const [serverTime, setServerTime] = useState<ServerTimeResponse | null>(null);
  const [serverClockMs, setServerClockMs] = useState<number>(() => Date.now());
  const serverClockSyncRef = useRef<{ serverMs: number; localMs: number } | null>(null);

  const [topbarError, setTopbarError] = useState<string | null>(null);

  const currentPath = location.pathname;
  const topbarMeta = useMemo(() => resolveTopbarMeta(currentPath, base), [currentPath, base]);

  const isManagerScopeEnabled = normalizedRole === 'ADMIN' || normalizedRole === 'SALES_MANAGER';
  const effectiveReminderScope: 'me' | 'team' = isManagerScopeEnabled ? reminderScope : 'me';

  const serverClockDate = useMemo(() => new Date(serverClockMs), [serverClockMs]);
  const serverChipDateText = serverTime?.jalali.pretty ?? formatJalali(serverClockDate, { dateOnly: true });
  const serverChipTimeText = serverTime
    ? formatServerClock(serverClockDate, serverTime.timezone)
    : formatServerClock(serverClockDate, 'Asia/Tehran');

  const calendarGridStart = useMemo(
    () => startOfWeek(startOfMonth(calendarViewMonth), { weekStartsOn: 6 }),
    [calendarViewMonth],
  );
  const calendarDays = useMemo(
    () => Array.from({ length: 42 }, (_, idx) => addDays(calendarGridStart, idx)),
    [calendarGridStart],
  );

  const fetchServerTime = async () => {
    try {
      const data = await apiGet<ServerTimeResponse>('/meta/server-time');
      setServerTime(data);
      const serverMs = new Date(data.serverNowIso).getTime();
      serverClockSyncRef.current = { serverMs, localMs: Date.now() };
      setServerClockMs(serverMs);
    } catch {
      // silent fallback to local time
    }
  };

  const fetchTodos = async (status = todoStatusFilter) => {
    if (!hasPermission('todos.read')) return;
    setTodoLoading(true);
    setTopbarError(null);
    try {
      const response = await apiGet<TodoListResponse>(`/todos?scope=me&status=${status}&limit=50`);
      setTodoData(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'خطا در دریافت To-do';
      setTopbarError(message);
    } finally {
      setTodoLoading(false);
    }
  };

  const fetchReminders = async () => {
    if (!hasPermission('dashboard.read')) return;
    setRemindersLoading(true);
    setTopbarError(null);
    try {
      const response = await apiGet<ReminderSummaryResponse>(
        `/reminders/summary?scope=${effectiveReminderScope}`,
      );
      setRemindersData(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'خطا در دریافت یادآورها';
      const endpointMissing =
        message.includes('Cannot GET') && message.includes('/reminders/summary');
      if (endpointMissing) {
        setRemindersData({
          scope: effectiveReminderScope,
          serverNowIso: new Date().toISOString(),
          waitingResponseDays: 2,
          counts: { overdueTasks: 0, overdueLeads: 0, waitingQuotes: 0, total: 0 },
          items: { tasks: [], leads: [], quotes: [] },
        });
        setTopbarError(null);
      } else {
        setTopbarError(message);
      }
    } finally {
      setRemindersLoading(false);
    }
  };

  useEffect(() => {
    const tick = () => {
      const sync = serverClockSyncRef.current;
      if (!sync) return;
      setServerClockMs(sync.serverMs + (Date.now() - sync.localMs));
    };
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchServerTime();
    const timer = window.setInterval(() => {
      if (!document.hidden) void fetchServerTime();
    }, 60_000);
    const onVisible = () => {
      if (!document.hidden) void fetchServerTime();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    void fetchReminders();
    const timer = window.setInterval(() => {
      if (!document.hidden) void fetchReminders();
    }, 60_000);
    const onVisible = () => {
      if (!document.hidden) void fetchReminders();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [effectiveReminderScope, normalizedRole]);

  useEffect(() => {
    if (!calendarOpen) return;
    void fetchServerTime();
    const baseDate = calendarSingle ?? calendarRangeFrom ?? new Date(serverTime?.serverNowIso ?? Date.now());
    setCalendarViewMonth(startOfMonth(baseDate));
  }, [calendarOpen, calendarSingle, calendarRangeFrom, serverTime?.serverNowIso]);

  useEffect(() => {
    if (!todoOpen) return;
    void fetchTodos(todoStatusFilter);
  }, [todoOpen, todoStatusFilter]);

  useEffect(() => {
    if (!remindersOpen) return;
    void fetchReminders();
  }, [remindersOpen, effectiveReminderScope]);

  useEffect(() => {
    if (!calendarOpen) return;
    const onClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [calendarOpen]);

  useEffect(() => {
    if (!todoOpen) return;
    const onClickOutside = (event: MouseEvent) => {
      if (todoRef.current && !todoRef.current.contains(event.target as Node)) {
        setTodoOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [todoOpen]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        commandInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onShortcut);
    return () => document.removeEventListener('keydown', onShortcut);
  }, []);

  const onCommandSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const query = commandQuery.trim();
    if (!query) return;

    if (query.startsWith('/')) {
      navigate(`${base}/${query.replace(/^\/+/, '')}`);
      setCommandQuery('');
      return;
    }

    const normalized = query.toLowerCase();
    const match = navItems.find(
      (item) =>
        item.label.toLowerCase().includes(normalized) ||
        item.href.toLowerCase().includes(normalized),
    );
    if (match) {
      navigate(`${base}/${match.href}`);
      setCommandQuery('');
    }
  };

  const onDemoSwitch = async () => {
    if (!demoSwitchTarget || !tenantSlug) return;
    await logout();
    navigate(`/t/${tenantSlug}/app/login?demoAs=${demoSwitchTarget.profile}&auto=1`, { replace: true });
  };

  const onCalendarDayClick = (day: Date) => {
    if (calendarMode === 'single') {
      setCalendarSingle(day);
      return;
    }

    if (!calendarRangeFrom || (calendarRangeFrom && calendarRangeTo)) {
      setCalendarRangeFrom(day);
      setCalendarRangeTo(null);
      return;
    }

    if (isBefore(day, calendarRangeFrom)) {
      setCalendarRangeTo(calendarRangeFrom);
      setCalendarRangeFrom(day);
      return;
    }

    setCalendarRangeTo(day);
  };

  const isRangeDay = (day: Date) =>
    !!calendarRangeFrom &&
    !!calendarRangeTo &&
    (isSameDay(day, calendarRangeFrom) ||
      isSameDay(day, calendarRangeTo) ||
      (isAfter(day, calendarRangeFrom) && isBefore(day, calendarRangeTo)));

  const createTodo = async () => {
    const title = todoTitle.trim();
    if (!title || !hasPermission('todos.write') || todoBusy) return;

    setTodoBusy(true);
    setTopbarError(null);

    const optimistic: TodoItem = {
      id: `temp-${Date.now()}`,
      userId: user?.id ?? 'me',
      title,
      dueAt: null,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setTodoTitle('');
    setTodoData((prev) =>
      prev
        ? {
            ...prev,
            counts: {
              open: prev.counts.open + 1,
              done: prev.counts.done,
              total: prev.counts.total + 1,
            },
            items:
              prev.status === 'open' || prev.status === 'all'
                ? [optimistic, ...prev.items]
                : prev.items,
          }
        : prev,
    );

    try {
      await apiPost('/todos', { title });
      await fetchTodos(todoStatusFilter);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'خطا در ایجاد To-do';
      setTopbarError(message);
      await fetchTodos(todoStatusFilter);
    } finally {
      setTodoBusy(false);
    }
  };

  const toggleTodo = async (item: TodoItem) => {
    if (!hasPermission('todos.write') || todoBusy) return;
    const nextStatus: TodoItem['status'] = item.status === 'DONE' ? 'OPEN' : 'DONE';
    setTodoBusy(true);
    setTopbarError(null);

    setTodoData((prev) =>
      prev
        ? {
            ...prev,
            counts: {
              open: prev.counts.open + (nextStatus === 'OPEN' ? 1 : -1),
              done: prev.counts.done + (nextStatus === 'DONE' ? 1 : -1),
              total: prev.counts.total,
            },
            items: prev.items
              .map((todo) => (todo.id === item.id ? { ...todo, status: nextStatus } : todo))
              .filter((todo) => {
                if (prev.status === 'all') return true;
                if (prev.status === 'open') return todo.status === 'OPEN';
                return todo.status === 'DONE';
              }),
          }
        : prev,
    );

    try {
      await apiPatch(`/todos/${item.id}`, { status: nextStatus });
      await fetchTodos(todoStatusFilter);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'خطا در به‌روزرسانی To-do';
      setTopbarError(message);
      await fetchTodos(todoStatusFilter);
    } finally {
      setTodoBusy(false);
    }
  };

  const snoozeTask = async (task: ReminderTaskItem) => {
    if (!hasPermission('tasks.write')) return;
    setRemindersBusyKey(`task:${task.id}`);
    setTopbarError(null);
    try {
      await apiPatch(`/tasks/${task.id}`, { dueAt: startOfTomorrow(remindersData?.serverNowIso) });
      await fetchReminders();
    } catch (error) {
      setTopbarError(error instanceof Error ? error.message : 'خطا در تعویق کار');
    } finally {
      setRemindersBusyKey(null);
    }
  };

  const snoozeLead = async (lead: ReminderLeadItem) => {
    if (!hasPermission('leads.write')) return;
    setRemindersBusyKey(`lead:${lead.id}`);
    setTopbarError(null);
    try {
      await apiPatch(`/leads/${lead.id}`, { followUpAt: startOfTomorrow(remindersData?.serverNowIso) });
      await fetchReminders();
    } catch (error) {
      setTopbarError(error instanceof Error ? error.message : 'خطا در تعویق لید');
    } finally {
      setRemindersBusyKey(null);
    }
  };

  const createQuoteFollowUp = async (quote: ReminderQuoteItem) => {
    if (!hasPermission('tasks.write')) return;
    setRemindersBusyKey(`quote:${quote.id}`);
    setTopbarError(null);
    try {
      await apiPost('/tasks', {
        title: `پیگیری پاسخ پیش‌فاکتور: ${quote.title}`,
        dueAt: startOfTomorrow(remindersData?.serverNowIso),
        dealId: quote.id,
        assignedToUserId: quote.ownerUserId ?? user?.id ?? undefined,
      });
      await fetchReminders();
    } catch (error) {
      setTopbarError(error instanceof Error ? error.message : 'خطا در ایجاد کار پیگیری');
    } finally {
      setRemindersBusyKey(null);
    }
  };

  return (
    <div className="min-h-screen flex bg-[var(--bg-default)] text-foreground">
      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          aria-label="بستن منو"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          app-shell-sidebar
          ${collapsed ? 'collapsed' : ''}
          fixed inset-y-0 start-0 z-30 flex flex-col
          bg-[#102448]
          border-e border-white/15
          transition-[width,transform] duration-200 ease-out
          lg:!translate-x-0
          ${mobileMenuOpen ? '!translate-x-0' : 'translate-x-full lg:!translate-x-0'}
        `}
      >
        {/* Sidebar header */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-white/15 px-3 bg-[#102448]">
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

        {/* Navigation */}
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
                  ${active ? 'bg-white/12 border border-white/30 text-white' : ''}
                  ${collapsed ? 'justify-center' : ''}
                `}
              >
                {content}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar collapse control */}
        <div className="shrink-0 border-t border-white/15 p-2 flex justify-end bg-[#102448]">
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

      {/* Main content */}
      <main className={`app-shell-main flex-1 flex flex-col min-w-0 ${collapsed ? 'collapsed' : ''}`}>
        {/* Topbar */}
        <header className="sticky top-0 z-20 border-b border-[var(--border-default)] bg-[var(--bg-toolbar)] backdrop-blur supports-[backdrop-filter]:bg-[var(--bg-toolbar)]/95">
  <div className="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <button
        type="button"
        onClick={() => setMobileMenuOpen((o) => !o)}
        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-[var(--bg-muted)] hover:text-foreground lg:hidden"
        aria-label="باز کردن منو"
      >
        <Menu className="size-5" aria-hidden />
      </button>
      <div className="min-w-0">
        <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap text-xs text-muted-foreground">
          {topbarMeta.crumbs.map((crumb, idx) => (
            <div key={`${crumb.label}-${idx}`} className="flex items-center gap-1">
              {idx > 0 && <span className="text-muted-foreground/70">/</span>}
              {crumb.href ? (
                <Link to={crumb.href} className="hover:text-foreground transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span>{crumb.label}</span>
              )}
            </div>
          ))}
        </div>
        <h1 className="truncate text-base font-semibold text-foreground md:text-lg">
          {topbarMeta.title}
        </h1>
      </div>
    </div>

    <div className="flex shrink-0 items-center gap-2">
      <form
        onSubmit={onCommandSubmit}
        className="hidden items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-default)] px-3 py-2 xl:flex"
      >
        <Search className="size-4 text-muted-foreground" aria-hidden />
        <input
          ref={commandInputRef}
          type="search"
          value={commandQuery}
          onChange={(event) => setCommandQuery(event.target.value)}
          placeholder="جستجو یا /route (Ctrl+K)"
          className="w-52 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </form>

      <div className="relative" ref={calendarRef}>
        <button
          type="button"
          onClick={() => setCalendarOpen((open) => !open)}
          className="flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-default)] px-2.5 py-2 text-sm transition-colors hover:bg-[var(--bg-muted)]"
          aria-expanded={calendarOpen}
          aria-haspopup="dialog"
          aria-label="تقویم"
        >
          <CalendarDays className="size-4 text-primary" aria-hidden />
          <span className="hidden text-start leading-tight md:block">
            <span className="block text-xs text-foreground">{serverChipDateText}</span>
            <span className="block text-xs text-muted-foreground">{serverChipTimeText}</span>
          </span>
        </button>

        {calendarOpen && (
          <div
            className="absolute end-0 top-full mt-2 w-[336px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-default)] p-3 shadow-xl"
            role="dialog"
            aria-label="تقویم شمسی"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">
                {formatJalaliFns(calendarViewMonth, 'MMMM yyyy', { locale: faIR })}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCalendarViewMonth((month) => subMonths(month, 1))}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-[var(--bg-muted)] hover:text-foreground"
                  aria-label="ماه قبل"
                >
                  <ChevronRight className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarViewMonth((month) => addMonths(month, 1))}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-[var(--bg-muted)] hover:text-foreground"
                  aria-label="ماه بعد"
                >
                  <ChevronLeft className="size-4" aria-hidden />
                </button>
              </div>
            </div>

            <div className="mb-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCalendarMode('single')}
                className={`rounded-lg px-2 py-1 text-xs transition-colors ${
                  calendarMode === 'single'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-[var(--bg-muted)] text-muted-foreground hover:text-foreground'
                }`}
              >
                تک‌تاریخ
              </button>
              <button
                type="button"
                onClick={() => setCalendarMode('range')}
                className={`rounded-lg px-2 py-1 text-xs transition-colors ${
                  calendarMode === 'range'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-[var(--bg-muted)] text-muted-foreground hover:text-foreground'
                }`}
              >
                بازه
              </button>
              <div className="ms-auto text-xs text-muted-foreground">
                {calendarMode === 'single'
                  ? formatPickerDate(calendarSingle)
                  : `${formatPickerDate(calendarRangeFrom)} — ${formatPickerDate(calendarRangeTo)}`}
              </div>
            </div>

            <div className="mb-2 grid grid-cols-7 gap-1">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="py-1 text-center text-[11px] font-medium text-muted-foreground"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const inMonth = isSameMonth(day, calendarViewMonth);
                const isSelectedSingle =
                  calendarMode === 'single' &&
                  !!calendarSingle &&
                  isSameDay(day, calendarSingle);
                const isRangeEdge =
                  calendarMode === 'range' &&
                  ((calendarRangeFrom && isSameDay(day, calendarRangeFrom)) ||
                    (calendarRangeTo && isSameDay(day, calendarRangeTo)));
                const isInRange = calendarMode === 'range' && isRangeDay(day);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => onCalendarDayClick(day)}
                    className={`h-9 rounded-lg text-sm transition-colors ${
                      isSelectedSingle || isRangeEdge
                        ? 'bg-primary text-primary-foreground'
                        : isInRange
                          ? 'bg-primary/15 text-primary'
                          : inMonth
                            ? 'text-foreground hover:bg-[var(--bg-muted)]'
                            : 'text-muted-foreground/60 hover:bg-[var(--bg-muted)]'
                    }`}
                  >
                    {formatJalaliFns(day, 'd', { locale: faIR })}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {hasPermission('todos.read') && (
        <div className="relative" ref={todoRef}>
          <button
            type="button"
            onClick={() => setTodoOpen((open) => !open)}
            className="relative rounded-xl border border-[var(--border-default)] bg-[var(--bg-default)] p-2.5 transition-colors hover:bg-[var(--bg-muted)]"
            aria-expanded={todoOpen}
            aria-haspopup="dialog"
            aria-label="To-do"
          >
            <ListTodo className="size-4 text-foreground" aria-hidden />
            {(todoData?.counts.open ?? 0) > 0 && (
              <span className="absolute -end-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                {formatFaNum(todoData?.counts.open ?? 0)}
              </span>
            )}
          </button>

          {todoOpen && (
            <div
              className="absolute end-0 top-full mt-2 w-[360px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-default)] p-3 shadow-xl"
              role="dialog"
              aria-label="لیست کارهای شخصی"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">To-do من</h3>
                  <p className="text-xs text-muted-foreground">
                    باز: {formatFaNum(todoData?.counts.open ?? 0)} | انجام‌شده: {formatFaNum(todoData?.counts.done ?? 0)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void fetchTodos(todoStatusFilter)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-[var(--bg-muted)] hover:text-foreground"
                  aria-label="به‌روزرسانی To-do"
                >
                  <RefreshCw className="size-4" aria-hidden />
                </button>
              </div>

              <div className="mb-3 flex items-center gap-1 rounded-lg bg-[var(--bg-muted)] p-1">
                {[
                  { key: 'open' as const, label: 'باز' },
                  { key: 'done' as const, label: 'انجام‌شده' },
                  { key: 'all' as const, label: 'همه' },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setTodoStatusFilter(filter.key)}
                    className={`flex-1 rounded-md px-2 py-1 text-xs transition-colors ${
                      todoStatusFilter === filter.key
                        ? 'bg-[var(--bg-default)] text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {hasPermission('todos.write') && (
                <div className="mb-3 flex items-center gap-2">
                  <input
                    type="text"
                    value={todoTitle}
                    onChange={(event) => setTodoTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void createTodo();
                      }
                    }}
                    placeholder="عنوان کار جدید..."
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-default)] px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => void createTodo()}
                    disabled={todoBusy}
                    className="rounded-lg bg-primary p-2 text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="افزودن To-do"
                  >
                    <Plus className="size-4" aria-hidden />
                  </button>
                </div>
              )}

              <div className="max-h-72 overflow-y-auto">
                {todoLoading ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">در حال دریافت...</div>
                ) : (todoData?.items.length ?? 0) === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">موردی برای نمایش نیست.</div>
                ) : (
                  <ul className="space-y-2">
                    {todoData?.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start gap-2 rounded-lg border border-[var(--border-default)] px-2.5 py-2"
                      >
                        <button
                          type="button"
                          onClick={() => void toggleTodo(item)}
                          disabled={todoBusy || !hasPermission('todos.write')}
                          className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                            item.status === 'DONE'
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-[var(--border-default)] bg-[var(--bg-default)] text-transparent'
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                          aria-label={item.status === 'DONE' ? 'بازگردانی کار' : 'علامت انجام'}
                        >
                          ✓
                        </button>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate text-sm ${
                              item.status === 'DONE'
                                ? 'text-muted-foreground line-through'
                                : 'text-foreground'
                            }`}
                          >
                            {item.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.dueAt ? `موعد: ${formatJalali(item.dueAt, { dateOnly: true })}` : 'بدون موعد'}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {hasPermission('dashboard.read') && (
        <button
          type="button"
          onClick={() => setRemindersOpen(true)}
          className="relative rounded-xl border border-[var(--border-default)] bg-[var(--bg-default)] p-2.5 transition-colors hover:bg-[var(--bg-muted)]"
          aria-label="یادآورها"
        >
          <Bell className="size-4 text-foreground" aria-hidden />
          {(remindersData?.counts.total ?? 0) > 0 && (
            <span className="absolute -end-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {formatFaNum(remindersData?.counts.total ?? 0)}
            </span>
          )}
        </button>
      )}

      {demoSwitchTarget && (
        <button
          type="button"
          onClick={() => void onDemoSwitch()}
          className="group relative hidden overflow-hidden rounded-xl border border-primary/35 bg-primary/10 px-3 py-2 text-xs font-medium text-primary shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary hover:text-primary-foreground md:inline-flex md:items-center md:gap-2"
          aria-label={demoSwitchTarget.label}
          title={demoSwitchTarget.label}
        >
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          <span className="relative">{demoSwitchTarget.label}</span>
          <ArrowUpRight className="relative size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
        </button>
      )}

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
                    title={resolvedRoleLabel}
                  >
                    {([user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.displayName || (user.email?.[0] ?? user.phone?.[0] ?? 'پ')).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="hidden md:flex flex-col items-start min-w-0 max-w-[140px]">
                  <span className="text-sm font-medium text-foreground truncate w-full text-start">
                    {[user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.displayName || (user.email ? user.email.split('@')[0].replace(/^./, (c) => c.toUpperCase()) : user.phone ?? 'کاربر')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {resolvedRoleLabel}
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
        </div>
      </div>
      {topbarError && (
        <div className="border-t border-[var(--border-default)] bg-rose-500/10 px-4 py-2 text-xs text-rose-500 md:px-6">
          {topbarError}
        </div>
      )}
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </div>
      </main>

      {remindersOpen && (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            onClick={() => setRemindersOpen(false)}
            aria-label="بستن یادآورها"
          />
          <aside className="absolute inset-y-0 right-0 w-full max-w-xl border-s border-[var(--border-default)] bg-[var(--bg-default)] shadow-2xl">
            <div className="flex h-full flex-col">
              <div className="border-b border-[var(--border-default)] px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">یادآورها</h2>
                    <p className="text-xs text-muted-foreground">
                      تسک‌های گذشته، لیدهای پیگیری‌نشده و پیش‌فاکتورهای بدون پاسخ
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRemindersOpen(false)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-[var(--bg-muted)] hover:text-foreground"
                    aria-label="بستن"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {isManagerScopeEnabled && (
                    <div className="flex items-center gap-1 rounded-lg bg-[var(--bg-muted)] p-1">
                      <button
                        type="button"
                        onClick={() => setReminderScope('me')}
                        className={`rounded-md px-2 py-1 text-xs transition-colors ${
                          effectiveReminderScope === 'me'
                            ? 'bg-[var(--bg-default)] text-foreground'
                            : 'text-muted-foreground'
                        }`}
                      >
                        من
                      </button>
                      <button
                        type="button"
                        onClick={() => setReminderScope('team')}
                        className={`rounded-md px-2 py-1 text-xs transition-colors ${
                          effectiveReminderScope === 'team'
                            ? 'bg-[var(--bg-default)] text-foreground'
                            : 'text-muted-foreground'
                        }`}
                      >
                        تیم
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void fetchReminders()}
                    className="ms-auto inline-flex items-center gap-1 rounded-lg border border-[var(--border-default)] px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="size-3.5" aria-hidden />
                    بروزرسانی
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                  <div className="rounded-lg border border-[var(--border-default)] p-2">
                    <div className="text-muted-foreground">کل</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                      {formatFaNum(remindersData?.counts.total ?? 0)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--border-default)] p-2">
                    <div className="text-muted-foreground">کارهای گذشته</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                      {formatFaNum(remindersData?.counts.overdueTasks ?? 0)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--border-default)] p-2">
                    <div className="text-muted-foreground">لیدهای گذشته</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                      {formatFaNum(remindersData?.counts.overdueLeads ?? 0)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--border-default)] p-2">
                    <div className="text-muted-foreground">منتظر پاسخ</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                      {formatFaNum(remindersData?.counts.waitingQuotes ?? 0)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto p-4">
                {remindersLoading ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">در حال دریافت...</div>
                ) : (
                  <>
                    <section>
                      <h3 className="mb-2 text-sm font-semibold text-foreground">کارهای سررسید گذشته</h3>
                      {(remindersData?.items.tasks.length ?? 0) === 0 ? (
                        <div className="rounded-lg border border-[var(--border-default)] p-3 text-xs text-muted-foreground">
                          موردی وجود ندارد.
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {remindersData?.items.tasks.map((task) => (
                            <li
                              key={task.id}
                              className="rounded-lg border border-[var(--border-default)] p-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium text-foreground">{task.title}</div>
                                  <div className="text-xs text-muted-foreground">
                                    موعد: {formatJalali(task.dueAt)} | تاخیر: {formatRelativeDays(task.overdueDays)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    مسئول: {task.assigneeName}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void snoozeTask(task)}
                                  disabled={
                                    remindersBusyKey === `task:${task.id}` || !hasPermission('tasks.write')
                                  }
                                  className="shrink-0 rounded-md border border-[var(--border-default)] px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  تعویق +۱ روز
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    <section>
                      <h3 className="mb-2 text-sm font-semibold text-foreground">لیدهای پیگیری‌نشده</h3>
                      {(remindersData?.items.leads.length ?? 0) === 0 ? (
                        <div className="rounded-lg border border-[var(--border-default)] p-3 text-xs text-muted-foreground">
                          موردی وجود ندارد.
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {remindersData?.items.leads.map((lead) => (
                            <li
                              key={lead.id}
                              className="rounded-lg border border-[var(--border-default)] p-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium text-foreground">{lead.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    پیگیری: {formatJalali(lead.followUpAt)} | تاخیر: {formatRelativeDays(lead.overdueDays)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    مالک: {lead.ownerName}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void snoozeLead(lead)}
                                  disabled={
                                    remindersBusyKey === `lead:${lead.id}` || !hasPermission('leads.write')
                                  }
                                  className="shrink-0 rounded-md border border-[var(--border-default)] px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  تعویق +۱ روز
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    <section>
                      <h3 className="mb-2 text-sm font-semibold text-foreground">
                        پیش‌فاکتورهای منتظر پاسخ ({formatFaNum(remindersData?.waitingResponseDays ?? 2)} روز)
                      </h3>
                      {(remindersData?.items.quotes.length ?? 0) === 0 ? (
                        <div className="rounded-lg border border-[var(--border-default)] p-3 text-xs text-muted-foreground">
                          موردی وجود ندارد.
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {remindersData?.items.quotes.map((quote) => (
                            <li
                              key={quote.id}
                              className="rounded-lg border border-[var(--border-default)] p-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium text-foreground">{quote.title}</div>
                                  <div className="text-xs text-muted-foreground">
                                    ارسال: {formatJalali(quote.sentAt)} | انتظار: {formatRelativeDays(quote.waitingDays)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    شرکت: {quote.companyName ?? '—'} | مالک: {quote.ownerName}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void createQuoteFollowUp(quote)}
                                  disabled={
                                    remindersBusyKey === `quote:${quote.id}` || !hasPermission('tasks.write')
                                  }
                                  className="shrink-0 rounded-md border border-[var(--border-default)] px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  ایجاد کار پیگیری
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}




