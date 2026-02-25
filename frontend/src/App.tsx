import { Routes, Route, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { AuthProvider } from './contexts/auth-context';
import AppLayout from './layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import ContactDetail from './pages/ContactDetail';
import CompanyDetail from './pages/CompanyDetail';
import DealDetail from './pages/DealDetail';
import TaskDetail from './pages/TaskDetail';
import Companies from './pages/Companies';
import Deals from './pages/Deals';
import Tasks from './pages/Tasks';
import Activity from './pages/Activity';
import LoginPage from './pages/Login';
import Import from './pages/Import';
import Leads from './pages/Leads';
import LeadDetail from './pages/LeadDetail';
import Settings from './pages/Settings';
import SettingsBilling from './pages/SettingsBilling';
import SettingsPipeline from './pages/SettingsPipeline';
import SettingsUsers from './pages/SettingsUsers';
import SettingsLeadSources from './pages/SettingsLeadSources';
import Members from './pages/Members';
import Profile from './pages/Profile';
import CallsPage from './pages/Calls';
import SmsPage from './pages/Sms';
import { ErrorPage, type ErrorPageVariant } from './components/error-page';
import { ProtectedRoute } from './components/ProtectedRoute';
import FloatingSupportFab from './components/FloatingSupportFab';

const BRAND_TITLE = 'ساختار';

const PAGE_LABELS: Record<string, string> = {
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

const SETTINGS_LABELS: Record<string, string> = {
  billing: 'اشتراک و صورت‌حساب',
  pipeline: 'پایپ‌لاین فروش',
  users: 'کاربران',
  'lead-sources': 'منابع لید',
};

function resolveDocumentTitle(pathname: string): string {
  const panelMatch = pathname.match(/^\/t\/[^/]+\/app(?:\/(.*))?$/);
  if (!panelMatch) return BRAND_TITLE;

  const rest = panelMatch[1] ?? '';
  const segments = rest.split('/').filter(Boolean);

  if (segments.length === 0 || segments[0] === 'dashboard') {
    return `داشبورد | ${BRAND_TITLE}`;
  }

  if (segments[0] === 'login') {
    return `ورود | ${BRAND_TITLE}`;
  }

  if (segments[0] === 'settings' && segments[1]) {
    const settingsLabel = SETTINGS_LABELS[segments[1]] ?? 'جزئیات تنظیمات';
    return `${settingsLabel} | ${BRAND_TITLE}`;
  }

  const sectionLabel = PAGE_LABELS[segments[0]] ?? 'پنل';
  if (segments.length > 1) {
    return `جزئیات | ${BRAND_TITLE}`;
  }

  return `${sectionLabel} | ${BRAND_TITLE}`;
}

function DocumentTitleManager() {
  const location = useLocation();

  const title = useMemo(() => resolveDocumentTitle(location.pathname), [location.pathname]);

  useEffect(() => {
    document.title = title;
  }, [title]);

  return null;
}

function MaintenancePage() {
  return (
    <ErrorPage
      variant="maintenance"
      actionHref="/"
      inline={false}
    />
  );
}

function NotFoundPage() {
  const { tenantSlug } = useParams<{ tenantSlug?: string }>();
  const backHref = tenantSlug ? `/t/${tenantSlug}/app` : '/';
  return (
    <ErrorPage
      variant="404"
      actionHref={backHref}
      actionLabel="برگشت به داشبورد"
      inline={false}
    />
  );
}

/** صفحهٔ خطا داخل Layout؛ از query بردار ?code=401|403|500 استفاده می‌کند. */
function AppErrorPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code') || '500';
  const variant: ErrorPageVariant =
    code === '401' ? '401' : code === '403' ? '403' : code === '404' ? '404' : '500';
  const base = `/t/${tenantSlug}/app`;
  const loginHref = `/t/${tenantSlug}/app/login`;
  return (
    <ErrorPage
      variant={variant}
      actionHref={variant === '401' ? loginHref : base}
      inline
    />
  );
}

export default function App() {
  return (
    <>
      <DocumentTitleManager />
      <FloatingSupportFab />
      <Routes>
        <Route path="/" element={<Navigate to="/t/demo/app" replace />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        <Route path="/t/:tenantSlug/app/login" element={<LoginPage />} />
        <Route path="/t/:tenantSlug/app" element={<AuthProvider><AppLayout /></AuthProvider>}>
          <Route index element={<ProtectedRoute requirePermissions={['dashboard.read']}><Dashboard /></ProtectedRoute>} />
          <Route path="dashboard" element={<ProtectedRoute requirePermissions={['dashboard.read']}><Dashboard /></ProtectedRoute>} />
          <Route path="contacts" element={<ProtectedRoute requirePermissions={['contacts.read']}><Contacts /></ProtectedRoute>} />
          <Route path="contacts/:id" element={<ProtectedRoute requirePermissions={['contacts.read']}><ContactDetail /></ProtectedRoute>} />
          <Route path="companies" element={<ProtectedRoute requirePermissions={['companies.read']}><Companies /></ProtectedRoute>} />
          <Route path="companies/:id" element={<ProtectedRoute requirePermissions={['companies.read']}><CompanyDetail /></ProtectedRoute>} />
          <Route path="quotes" element={<ProtectedRoute requireAnyPermissions={['quotes.read', 'invoices.read']}><Deals /></ProtectedRoute>} />
          <Route path="quotes/:id" element={<ProtectedRoute requireAnyPermissions={['quotes.read', 'invoices.read']}><DealDetail /></ProtectedRoute>} />
          <Route path="deals" element={<ProtectedRoute requireAnyPermissions={['quotes.read', 'invoices.read']}><Deals /></ProtectedRoute>} />
          <Route path="deals/:id" element={<ProtectedRoute requireAnyPermissions={['quotes.read', 'invoices.read']}><DealDetail /></ProtectedRoute>} />
          <Route path="tasks" element={<ProtectedRoute requirePermissions={['tasks.read']}><Tasks /></ProtectedRoute>} />
          <Route path="tasks/:id" element={<ProtectedRoute requirePermissions={['tasks.read']}><TaskDetail /></ProtectedRoute>} />
          <Route path="activity" element={<ProtectedRoute requirePermissions={['activities.read']}><Activity /></ProtectedRoute>} />
          <Route path="calls" element={<ProtectedRoute requirePermissions={['calls.read']}><CallsPage /></ProtectedRoute>} />
          <Route path="sms" element={<ProtectedRoute requirePermissions={['sms.read']}><SmsPage /></ProtectedRoute>} />
          <Route path="import" element={<ProtectedRoute requirePermissions={['imports.read']}><Import /></ProtectedRoute>} />
          <Route path="leads" element={<ProtectedRoute requirePermissions={['leads.read']}><Leads /></ProtectedRoute>} />
          <Route path="leads/:id" element={<ProtectedRoute requirePermissions={['leads.read', 'timeline.read']}><LeadDetail /></ProtectedRoute>} />
          <Route path="profile" element={<Profile />} />
          <Route path="members" element={<ProtectedRoute requirePermissions={['users.read']}><Members /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute requirePermissions={['settings.read']}><Settings /></ProtectedRoute>} />
          <Route path="settings/billing" element={<ProtectedRoute requirePermissions={['settings.read', 'invoices.read']}><SettingsBilling /></ProtectedRoute>} />
          <Route path="settings/pipeline" element={<ProtectedRoute requirePermissions={['settings.read']}><SettingsPipeline /></ProtectedRoute>} />
          <Route path="settings/users" element={<ProtectedRoute requirePermissions={['settings.read', 'users.read']}><SettingsUsers /></ProtectedRoute>} />
          <Route path="settings/lead-sources" element={<ProtectedRoute requirePermissions={['settings.read']}><SettingsLeadSources /></ProtectedRoute>} />
          <Route path="error" element={<AppErrorPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
