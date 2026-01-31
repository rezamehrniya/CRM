/**
 * Route Guard برای محدود کردن دسترسی به نقش OWNER (Admin).
 * مرجع: docs/specs/RBAC-PANELS.md
 */
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';

type ProtectedRouteProps = {
  children: React.ReactNode;
  /** اگر true، فقط OWNER دسترسی دارد؛ غیر-OWNER به صفحه 403 هدایت می‌شود. */
  requireOwner?: boolean;
};

/**
 * اگر requireOwner باشد و کاربر MEMBER باشد، به /app/error?code=403 ریدایرکت می‌شود.
 * در حالت loading هنوز نقش مشخص نیست؛ children رندر می‌شود تا پس از بارگذاری تصمیم گرفته شود.
 */
export function ProtectedRoute({ children, requireOwner = false }: ProtectedRouteProps) {
  const { role, loading } = useAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-muted-foreground">
        در حال بارگذاری...
      </div>
    );
  }

  if (requireOwner && role !== 'OWNER') {
    const to = tenantSlug ? `/t/${tenantSlug}/app/error?code=403` : '/';
    return <Navigate to={to} replace />;
  }

  return <>{children}</>;
}
