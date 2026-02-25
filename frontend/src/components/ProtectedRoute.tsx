import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';

type ProtectedRouteProps = {
  children: React.ReactNode;
  requireOwner?: boolean;
  requirePermissions?: string[];
  requireAnyPermissions?: string[];
};

export function ProtectedRoute({
  children,
  requireOwner = false,
  requirePermissions,
  requireAnyPermissions,
}: ProtectedRouteProps) {
  const { role, loading, hasPermission } = useAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-muted-foreground">
        در حال بارگذاری...
      </div>
    );
  }

  const isOwner = role === 'ADMIN';
  const hasAll = (requirePermissions ?? []).every((permission) => hasPermission(permission));
  const hasAny =
    !requireAnyPermissions || requireAnyPermissions.length === 0
      ? true
      : requireAnyPermissions.some((permission) => hasPermission(permission));

  const allowed = (requireOwner ? isOwner : true) && hasAll && hasAny;

  if (!allowed) {
    const to = tenantSlug ? `/t/${tenantSlug}/app/error?code=403` : '/';
    return <Navigate to={to} replace />;
  }

  return <>{children}</>;
}
