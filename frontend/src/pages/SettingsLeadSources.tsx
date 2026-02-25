/**
 * زیرصفحهٔ تنظیمات: منابع لید — فقط OWNER.
 * فعلاً placeholder؛ تعریف منابع ورود لید (سایت، تبلیغ، تماس) در نسخهٔ بعد.
 */
import { Link, useParams } from 'react-router-dom';
import { Link2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { ErrorPage } from '@/components/error-page';

export default function SettingsLeadSources() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { hasPermission, loading: authLoading } = useAuth();
  const canAccessSettings = hasPermission('settings.read');
  const base = `/t/${tenantSlug}/app`;

  if (authLoading) {
    return <div className="text-muted-foreground">در حال بارگذاری...</div>;
  }

  if (!canAccessSettings) {
    return (
      <ErrorPage
        variant="403"
        title="دسترسی غیرمجاز"
        description="فقط مدیر می‌تواند به منابع لید دسترسی داشته باشد."
        actionHref={`${base}/settings`}
        actionLabel="برگشت به تنظیمات"
        inline
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to={`${base}/settings`} className="hover:text-foreground">
          تنظیمات
        </Link>
        <ArrowRight className="size-4" aria-hidden />
        <span className="text-foreground">منابع لید</span>
      </div>
      <h1 className="text-title-lg font-title">منابع لید</h1>

      <div className="glass-card rounded-card p-8 flex flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-xl bg-primary/15 p-3 text-primary">
          <Link2 className="size-8" aria-hidden />
        </div>
        <div>
          <h2 className="font-title text-base mb-1">به زودی</h2>
          <p className="text-sm text-muted-foreground">
            تعریف منابع ورود لید (سایت، تبلیغ، تماس) در نسخهٔ بعدی در دسترس خواهد بود.
          </p>
        </div>
      </div>

      <Link
        to={`${base}/settings`}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-input bg-transparent px-4 py-2 font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        برگشت به تنظیمات
      </Link>
    </div>
  );
}
