import { Routes, Route, Navigate, useParams, useSearchParams } from 'react-router-dom';
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
import Settings from './pages/Settings';
import SettingsBilling from './pages/SettingsBilling';
import SettingsPipeline from './pages/SettingsPipeline';
import SettingsUsers from './pages/SettingsUsers';
import SettingsLeadSources from './pages/SettingsLeadSources';
import { ErrorPage, type ErrorPageVariant } from './components/error-page';
import { ProtectedRoute } from './components/ProtectedRoute';

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
    <Routes>
      <Route path="/" element={<Navigate to="/t/demo/app" replace />} />
      <Route path="/maintenance" element={<MaintenancePage />} />
      <Route path="/t/:tenantSlug/app/login" element={<LoginPage />} />
      <Route path="/t/:tenantSlug/app" element={<AuthProvider><AppLayout /></AuthProvider>}>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="contacts/:id" element={<ContactDetail />} />
        <Route path="companies" element={<Companies />} />
        <Route path="companies/:id" element={<CompanyDetail />} />
        <Route path="deals" element={<Deals />} />
        <Route path="deals/:id" element={<DealDetail />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="tasks/:id" element={<TaskDetail />} />
        <Route path="activity" element={<Activity />} />
        <Route path="import" element={<Import />} />
        <Route path="settings" element={<ProtectedRoute requireOwner><Settings /></ProtectedRoute>} />
        <Route path="settings/billing" element={<ProtectedRoute requireOwner><SettingsBilling /></ProtectedRoute>} />
        <Route path="settings/pipeline" element={<ProtectedRoute requireOwner><SettingsPipeline /></ProtectedRoute>} />
        <Route path="settings/users" element={<ProtectedRoute requireOwner><SettingsUsers /></ProtectedRoute>} />
        <Route path="settings/lead-sources" element={<ProtectedRoute requireOwner><SettingsLeadSources /></ProtectedRoute>} />
        <Route path="error" element={<AppErrorPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
