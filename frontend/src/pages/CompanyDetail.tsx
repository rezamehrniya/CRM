/**
 * صفحهٔ جزئیات شرکت — مشخصات + مخاطبین + معاملات + خلاصه Customer 360.
 */
import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Building2, Phone, Globe, Users, HandCoins, LayoutGrid, ArrowRight } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { formatFaNum } from '@/lib/numbers';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorPage } from '@/components/error-page';

type CompanyDetailData = {
  id: string;
  name: string;
  phone?: string | null;
  website?: string | null;
  _count?: { contacts: number };
  contacts?: Array<{ id: string; fullName: string; phone?: string | null; email?: string | null }>;
  deals?: Array<{
    id: string;
    title: string;
    amount?: unknown;
    stage?: { name: string };
  }>;
};

export default function CompanyDetail() {
  const { tenantSlug, id } = useParams<{ tenantSlug: string; id: string }>();
  const base = `/t/${tenantSlug}/app`;
  const [company, setCompany] = useState<CompanyDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    apiGet<CompanyDetailData>(`/companies/${id}`)
      .then(setCompany)
      .catch((e) => setError(e?.message ?? 'خطا'))
      .finally(() => setLoading(false));
  }, [id]);

  if (!id) {
    return (
      <ErrorPage
        variant="404"
        title="شرکت یافت نشد"
        description="شناسهٔ شرکت معتبر نیست."
        actionHref={`${base}/companies`}
        actionLabel="برگشت به شرکت‌ها"
        inline
      />
    );
  }

  if (error && !company) {
    return (
      <div className="space-y-5">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link to={base}>پنل</Link>
          <ChevronLeft className="size-4 shrink-0" aria-hidden />
          <Link to={`${base}/companies`}>شرکت‌ها</Link>
        </nav>
        <ErrorPage
          variant="404"
          title="شرکت یافت نشد"
          description={error}
          actionHref={`${base}/companies`}
          actionLabel="برگشت به شرکت‌ها"
          inline
        />
      </div>
    );
  }

  const contacts = company?.contacts ?? [];
  const deals = company?.deals ?? [];

  return (
    <div className="space-y-5">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-1" aria-label="مسیر">
        <Link to={base} className="hover:text-foreground transition-colors">
          پنل
        </Link>
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        <Link to={`${base}/companies`} className="hover:text-foreground transition-colors">
          شرکت‌ها
        </Link>
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        <span className="text-foreground font-medium truncate max-w-[180px]">
          {loading ? '…' : company?.name ?? 'شرکت'}
        </span>
      </nav>

      {loading ? (
        <div className="glass-card rounded-card p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ) : company ? (
        <>
          <div className="glass-card rounded-card p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/15 p-3 text-primary">
                  <Building2 className="size-6" aria-hidden />
                </div>
                <div>
                  <h1 className="text-title-lg font-title">{company.name}</h1>
                  <p className="text-sm text-muted-foreground">شرکت</p>
                </div>
              </div>
              <Button type="button" variant="outline" asChild>
                <Link to={`${base}/companies`}>برگشت به لیست</Link>
              </Button>
            </div>

            <dl className="mt-6 space-y-4">
              {company.phone != null && company.phone !== '' && (
                <div className="flex items-center gap-3">
                  <Phone className="size-5 text-muted-foreground shrink-0" aria-hidden />
                  <div>
                    <dt className="text-xs text-muted-foreground">تلفن</dt>
                    <dd className="font-medium fa-num">{company.phone}</dd>
                  </div>
                </div>
              )}
              {company.website != null && company.website !== '' && (
                <div className="flex items-center gap-3">
                  <Globe className="size-5 text-muted-foreground shrink-0" aria-hidden />
                  <div>
                    <dt className="text-xs text-muted-foreground">وب‌سایت</dt>
                    <dd>
                      <a
                        href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline"
                      >
                        {company.website}
                      </a>
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          </div>

          {/* Customer 360 Summary */}
          <div className="glass-card rounded-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <LayoutGrid className="size-5 text-primary" aria-hidden />
              <h2 className="font-title text-base">خلاصه وضعیت (Customer 360)</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="size-4" aria-hidden />
                  <span className="text-sm">مخاطبین</span>
                </div>
                <p className="text-xl font-bold fa-num">{contacts.length}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <HandCoins className="size-4" aria-hidden />
                  <span className="text-sm">معاملات</span>
                </div>
                <p className="text-xl font-bold fa-num">{deals.length}</p>
              </div>
            </div>
          </div>

          {/* مخاطبین */}
          <div className="glass-card rounded-card p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="font-title text-base flex items-center gap-2">
                <Users className="size-5 text-primary" aria-hidden />
                مخاطبین
              </h2>
              <Link to={`${base}/contacts`} className="text-sm text-primary hover:underline">
                همه مخاطبین
              </Link>
            </div>
            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">مخاطبی برای این شرکت ثبت نشده است.</p>
            ) : (
              <ul className="space-y-2">
                {contacts.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <Link to={`${base}/contacts/${c.id}`} className="font-medium text-primary hover:underline">
                      {c.fullName}
                    </Link>
                    <span className="text-sm text-muted-foreground fa-num">{c.phone ?? c.email ?? '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* معاملات */}
          <div className="glass-card rounded-card p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="font-title text-base flex items-center gap-2">
                <HandCoins className="size-5 text-primary" aria-hidden />
                معاملات
              </h2>
              <Link to={`${base}/deals`} className="text-sm text-primary hover:underline">
                همه معاملات
              </Link>
            </div>
            {deals.length === 0 ? (
              <p className="text-sm text-muted-foreground">معامله‌ای برای این شرکت ثبت نشده است.</p>
            ) : (
              <ul className="space-y-2">
                {deals.map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <Link to={`${base}/deals/${d.id}`} className="font-medium text-primary hover:underline">
                      {d.title}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {d.stage?.name ?? '—'} · <span className="fa-num">{formatFaNum(d.amount)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            to={`${base}/companies`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-input bg-transparent px-4 py-2 font-medium transition-colors hover:bg-muted"
          >
            <ArrowRight className="size-4" aria-hidden />
            برگشت به شرکت‌ها
          </Link>
        </>
      ) : null}
    </div>
  );
}
