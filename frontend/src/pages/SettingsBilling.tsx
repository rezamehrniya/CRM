/**
 * زیرصفحهٔ تنظیمات: اشتراک و صورتحساب — فقط OWNER.
 * مرجع: docs/specs/BILLING-SEATS.md
 */
import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CreditCard, ArrowRight, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { apiGet } from '@/lib/api';
import { formatFaNum } from '@/lib/numbers';
import { ErrorPage } from '@/components/error-page';
import { Skeleton } from '@/components/ui/skeleton';
import { JalaliDate } from '@/components/ui/jalali-date';

type Subscription = {
  status: string;
  planCode: string | null;
  endsAt: string | null;
  seatLimit: number;
  baseSeatLimit?: number;
  addonSeatCount?: number;
};

type Usage = {
  activeSeats: number;
  seatLimit: number;
};

type Invoice = {
  id: string;
  status: string;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  totalAmount: number | null;
};

export default function SettingsBilling() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { hasPermission, loading: authLoading } = useAuth();
  const canAccessBilling = hasPermission('settings.read') && hasPermission('invoices.read');
  const base = `/t/${tenantSlug}/app`;
  const [sub, setSub] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canAccessBilling) return;
    Promise.all([
      apiGet<Subscription>('/billing/subscription'),
      apiGet<Usage>('/billing/usage'),
      apiGet<Invoice[]>('/billing/invoices'),
    ])
      .then(([s, u, inv]) => {
        setSub(s);
        setUsage(u);
        setInvoices(Array.isArray(inv) ? inv : []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [canAccessBilling]);

  if (authLoading) {
    return <div className="text-muted-foreground">در حال بارگذاری...</div>;
  }

  if (!canAccessBilling) {
    return (
      <ErrorPage
        variant="403"
        title="دسترسی غیرمجاز"
        description="فقط مدیر می‌تواند به اشتراک و صورتحساب دسترسی داشته باشد."
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
        <span className="text-foreground">اشتراک و صورتحساب</span>
      </div>
      <h1 className="text-title-lg font-title">اشتراک و صورتحساب</h1>

      {error && (
        <div className="rounded-card border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="glass-card rounded-card p-5 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      ) : sub && usage ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="glass-card rounded-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="size-5 text-primary" aria-hidden />
              <h2 className="font-title text-base">وضعیت اشتراک</h2>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">وضعیت</dt>
                <dd className={sub.status === 'ACTIVE' ? 'text-green-600 dark:text-green-400' : 'text-destructive'}>
                  {sub.status === 'ACTIVE' ? 'فعال' : 'منقضی'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">پلن</dt>
                <dd>{sub.planCode ?? '—'}</dd>
              </div>
              {sub.endsAt && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">پایان اشتراک</dt>
                  <dd><JalaliDate value={sub.endsAt} dateOnly /></dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">سقف صندلی</dt>
                <dd className="fa-num">{formatFaNum(sub.seatLimit)}</dd>
              </div>
            </dl>
          </div>
          <div className="glass-card rounded-card p-5">
            <h2 className="font-title text-base mb-3">استفاده</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">صندلی‌های فعال</dt>
                <dd className="fa-num">{formatFaNum(usage.activeSeats)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">سقف</dt>
                <dd className="fa-num">{formatFaNum(usage.seatLimit)}</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}

      {!loading && (
        <div className="glass-card rounded-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="size-5 text-primary" aria-hidden />
            <h2 className="font-title text-base">صورتحساب‌ها</h2>
          </div>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">هنوز صورتحسابی ثبت نشده است.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-start p-2 font-medium">تاریخ صدور</th>
                    <th className="text-start p-2 font-medium">وضعیت</th>
                    <th className="text-start p-2 font-medium">مبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-border">
                      <td className="p-2">
                        <JalaliDate value={inv.issuedAt} dateOnly />
                      </td>
                      <td className="p-2">
                        {inv.status === 'PAID' ? 'پرداخت‌شده' : inv.status === 'ISSUED' ? 'صادرشده' : inv.status === 'DRAFT' ? 'پیش‌نویس' : inv.status}
                      </td>
                      <td className="p-2 fa-num">
                        {inv.totalAmount != null ? formatFaNum(inv.totalAmount) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
