/**
 * وضعیت احراز هویت و نقش کاربر برای RBAC (پنل Admin vs Sales).
 * مرجع: docs/specs/RBAC-PANELS.md
 */
import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiPost, getAccessToken, clearAccessToken } from '@/lib/api';

const ROLE_PERMISSION_FALLBACK: Record<string, string[]> = {
  ADMIN: ['*', 'meta.read', 'timeline.read', 'todos.read', 'todos.write', 'todos.manage'],
  SALES_MANAGER: [
    'meta.read',
    'dashboard.read',
    'timeline.read',
    'sms.read', 'sms.write', 'sms.team.read', 'sms.bulk.send', 'sms.manage',
    'calls.read', 'calls.team.read', 'calls.manage',
    'todos.read', 'todos.write', 'todos.manage',
    'contacts.read', 'contacts.write', 'contacts.manage',
    'companies.read', 'companies.write', 'companies.manage',
    'leads.read', 'leads.write', 'leads.manage',
    'tasks.read', 'tasks.write', 'tasks.manage',
    'activities.read', 'activities.write', 'activities.manage',
    'quotes.read', 'quotes.write', 'quotes.manage',
    'invoices.read', 'invoices.write', 'invoices.manage',
    'products.read', 'products.write', 'products.manage',
    'imports.read', 'imports.write', 'imports.manage',
    'users.read',
    'settings.read',
  ],
  SALES_REP: [
    'meta.read',
    'dashboard.read',
    'timeline.read',
    'sms.read', 'sms.write',
    'calls.read',
    'todos.read', 'todos.write', 'todos.manage',
    'contacts.read', 'contacts.write',
    'companies.read', 'companies.write',
    'leads.read', 'leads.write',
    'tasks.read', 'tasks.write',
    'activities.read', 'activities.write',
    'quotes.read', 'quotes.write',
    'invoices.read', 'invoices.write',
    'products.read',
    'imports.read',
    'settings.read',
  ],
  VIEWER: [
    'meta.read',
    'dashboard.read',
    'timeline.read',
    'contacts.read',
    'companies.read',
    'leads.read',
    'tasks.read',
    'activities.read',
    'quotes.read',
    'invoices.read',
    'products.read',
    'imports.read',
    'users.read',
    'settings.read',
  ],
};

function normalizeRole(raw?: string | null): string {
  const role = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (role === 'OWNER') return 'ADMIN';
  if (role === 'MEMBER') return 'SALES_REP';
  if (role === 'SALESREP') return 'SALES_REP';
  if (role === 'SALESMANAGER') return 'SALES_MANAGER';
  return role;
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

function permissionsFromRole(role?: string | null): string[] {
  const normalized = normalizeRole(role);
  return [...(ROLE_PERMISSION_FALLBACK[normalized] ?? [])];
}

type MeResponse = {
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    profileComplete: boolean;
  } | null;
  tenant: { id: string; slug: string; name: string } | null;
  role?: string;
  roleName?: string | null;
  permissions?: string[];
};

type AuthState = {
  user: MeResponse['user'];
  tenant: MeResponse['tenant'];
  role: string | null;
  roleName: string | null;
  permissions: string[];
  loading: boolean;
};

const initialState: AuthState = {
  user: null,
  tenant: null,
  role: null,
  roleName: null,
  permissions: [],
  loading: true,
};

const AuthContext = React.createContext<
  AuthState & {
    refetch: () => Promise<void>;
    logout: () => Promise<void>;
    hasPermission: (permission: string) => boolean;
  }
>({
  ...initialState,
  refetch: async () => {},
  logout: async () => {},
  hasPermission: () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>(initialState);
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug?: string }>();

  const fetchMe = React.useCallback(async () => {
    if (!getAccessToken()) {
      setState({ user: null, tenant: null, role: null, roleName: null, permissions: [], loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await apiGet<MeResponse>('/auth/me');
      const u = data.user;
      const profileComplete = u?.profileComplete ?? (!!u?.firstName?.trim() && !!u?.lastName?.trim());
      const effectiveRole = normalizeRole(data.role ?? roleFromRoleName(data.roleName) ?? null);
      const permissions = Array.isArray(data.permissions)
        ? data.permissions.filter((value): value is string => typeof value === 'string')
        : [];
      const effectivePermissions = permissions.length > 0 ? permissions : permissionsFromRole(effectiveRole);
      setState({
        user: u ? { ...u, profileComplete } : null,
        tenant: data.tenant,
        role: effectiveRole || null,
        roleName: data.roleName ?? null,
        permissions: effectivePermissions,
        loading: false,
      });
    } catch {
      clearAccessToken();
      setState({ user: null, tenant: null, role: null, roleName: null, permissions: [], loading: false });
      if (tenantSlug) {
        navigate(`/t/${tenantSlug}/app/login`, { replace: true });
      }
    }
  }, [navigate, tenantSlug]);

  const logout = React.useCallback(async () => {
    try {
      await apiPost('/auth/logout');
    } catch {
      /**/
    } finally {
      clearAccessToken();
      setState({ user: null, tenant: null, role: null, roleName: null, permissions: [], loading: false });
      if (tenantSlug) {
        navigate(`/t/${tenantSlug}/app/login`, { replace: true });
      }
    }
  }, [navigate, tenantSlug]);

  React.useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const value = React.useMemo(
    () => ({
      ...state,
      refetch: fetchMe,
      logout,
      hasPermission: (permission: string) => {
        if (state.permissions.includes('*') || state.permissions.includes(permission)) {
          return true;
        }
        const fallbackPermissions = permissionsFromRole(state.role);
        return fallbackPermissions.includes(permission);
      },
    }),
    [state, fetchMe, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

/** آیا کاربر نقش Admin دارد؟ */
export function useIsAdmin(): boolean {
  const { hasPermission } = useAuth();
  return hasPermission('settings.manage');
}
