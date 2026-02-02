/**
 * وضعیت احراز هویت و نقش کاربر برای RBAC (پنل Admin vs Sales).
 * مرجع: docs/specs/RBAC-PANELS.md
 */
import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiPost, getAccessToken, clearAccessToken } from '@/lib/api';

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
};

type AuthState = {
  user: MeResponse['user'];
  tenant: MeResponse['tenant'];
  role: string | null;
  loading: boolean;
};

const initialState: AuthState = {
  user: null,
  tenant: null,
  role: null,
  loading: true,
};

const AuthContext = React.createContext<AuthState & { refetch: () => Promise<void>; logout: () => Promise<void> }>({
  ...initialState,
  refetch: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>(initialState);
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug?: string }>();

  const fetchMe = React.useCallback(async () => {
    if (!getAccessToken()) {
      setState({ user: null, tenant: null, role: null, loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await apiGet<MeResponse>('/auth/me');
      const u = data.user;
      const profileComplete = u?.profileComplete ?? (!!u?.firstName?.trim() && !!u?.lastName?.trim());
      setState({
        user: u ? { ...u, profileComplete } : null,
        tenant: data.tenant,
        role: data.role ?? null,
        loading: false,
      });
    } catch {
      clearAccessToken();
      setState({ user: null, tenant: null, role: null, loading: false });
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
      setState({ user: null, tenant: null, role: null, loading: false });
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

/** آیا کاربر نقش Admin (OWNER) دارد؟ */
export function useIsAdmin(): boolean {
  const { role } = useAuth();
  return role === 'OWNER';
}
