/**
 * زیرصفحهٔ تنظیمات: مدیریت کاربران و نقش‌ها — فقط OWNER.
 * مرجع: docs/specs/RBAC-PANELS.md
 */
import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Users, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { apiGet } from '@/lib/api';
import { ErrorPage } from '@/components/error-page';
import { Skeleton } from '@/components/ui/skeleton';

type Member = {
  id: string;
  role: string;
  status: string;
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    status: string;
  };
};

export default function SettingsUsers() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { role, loading: authLoading } = useAuth();
  const base = `/t/${tenantSlug}/app`;
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (role !== 'OWNER') return;
    apiGet<Member[]>('/settings/members')
      .then((data) => setMembers(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [role]);

  if (authLoading) {
    return <div className="text-muted-foreground">در حال بارگذاری...</div>;
  }

  if (role !== 'OWNER') {
    return (
      <ErrorPage
        variant="403"
        title="دسترسی غیرمجاز"
        description="فقط مدیر می‌تواند به مدیریت کاربران دسترسی داشته باشد."
        actionHref={`${base}/settings`}
        actionLabel="برگشت به تنظیمات"
        inline
      />
    );
  }

  const roleLabel = (r: string) => (r === 'OWNER' ? 'مدیر' : 'فروشنده');
  const statusLabel = (s: string) =>
    s === 'ACTIVE' ? 'فعال' : s === 'INVITED' ? 'دعوت‌شده' : s === 'DISABLED' ? 'غیرفعال' : s;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to={`${base}/settings`} className="hover:text-foreground">
          تنظیمات
        </Link>
        <ArrowRight className="size-4" aria-hidden />
        <span className="text-foreground">مدیریت کاربران</span>
      </div>
      <h1 className="text-title-lg font-title">مدیریت کاربران و نقش‌ها</h1>

      {error && (
        <div className="rounded-card border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="glass-card rounded-card p-5 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : members.length === 0 ? (
        <div className="glass-card rounded-card p-5">
          <p className="text-sm text-muted-foreground">هنوز کاربری در این Tenant ثبت نشده است.</p>
        </div>
      ) : (
        <div className="glass-card rounded-card p-5 overflow-x-auto">
          <div className="flex items-center gap-2 mb-3">
            <Users className="size-5 text-primary" aria-hidden />
            <h2 className="font-title text-base">اعضا</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-start p-2 font-medium">ایمیل / تلفن</th>
                <th className="text-start p-2 font-medium">نقش</th>
                <th className="text-start p-2 font-medium">وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-border">
                  <td className="p-2">
                    {m.user.email ?? m.user.phone ?? '—'}
                  </td>
                  <td className="p-2">{roleLabel(m.role)}</td>
                  <td className="p-2">{statusLabel(m.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Link
        to={`${base}/settings`}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-input bg-transparent px-4 py-2 font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        برگشت به تنظیمات
      </Link>
    </div>
  );
}
