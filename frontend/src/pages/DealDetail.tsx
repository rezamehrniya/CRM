/**
 * صفحهٔ جزئیات معامله — عنوان، مبلغ، مرحله، لینک مخاطب/شرکت.
 */
import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, HandCoins, User, Building2, ArrowRight } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { formatFaNum } from '@/lib/numbers';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorPage } from '@/components/error-page';

type DealDetailData = {
  id: string;
  title: string;
  amount?: unknown;
  stage?: { id: string; name: string };
  pipeline?: { id: string; name: string };
  contact?: { id: string; fullName: string } | null;
  company?: { id: string; name: string } | null;
};

export default function DealDetail() {
  const { tenantSlug, id } = useParams<{ tenantSlug: string; id: string }>();
  const base = `/t/${tenantSlug}/app`;
  const [deal, setDeal] = useState<DealDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    apiGet<DealDetailData>(`/deals/${id}`)
      .then(setDeal)
      .catch((e) => setError(e?.message ?? 'خطا'))
      .finally(() => setLoading(false));
  }, [id]);

  if (!id) {
    return (
      <ErrorPage
        variant="404"
        title="معامله یافت نشد"
        description="شناسهٔ معامله معتبر نیست."
        actionHref={`${base}/deals`}
        actionLabel="برگشت به معاملات"
        inline
      />
    );
  }

  if (error && !deal) {
    return (
      <div className="space-y-5">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link to={base}>پنل</Link>
          <ChevronLeft className="size-4 shrink-0" aria-hidden />
          <Link to={`${base}/deals`}>معاملات</Link>
        </nav>
        <ErrorPage
          variant="404"
          title="معامله یافت نشد"
          description={error}
          actionHref={`${base}/deals`}
          actionLabel="برگشت به معاملات"
          inline
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-1" aria-label="مسیر">
        <Link to={base} className="hover:text-foreground transition-colors">
          پنل
        </Link>
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        <Link to={`${base}/deals`} className="hover:text-foreground transition-colors">
          معاملات
        </Link>
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        <span className="text-foreground font-medium truncate max-w-[180px]">
          {loading ? '…' : deal?.title ?? 'معامله'}
        </span>
      </nav>

      {loading ? (
        <div className="glass-card rounded-card p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ) : deal ? (
        <>
          <div className="glass-card rounded-card p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/15 p-3 text-primary">
                  <HandCoins className="size-6" aria-hidden />
                </div>
                <div>
                  <h1 className="text-title-lg font-title">{deal.title}</h1>
                  <p className="text-sm text-muted-foreground">معامله</p>
                </div>
              </div>
              <Button type="button" variant="outline" asChild>
                <Link to={`${base}/deals`}>برگشت به لیست</Link>
              </Button>
            </div>

            <dl className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                <HandCoins className="size-5 text-muted-foreground shrink-0" aria-hidden />
                <div>
                  <dt className="text-xs text-muted-foreground">مبلغ</dt>
                  <dd className="font-medium fa-num">{formatFaNum(deal.amount)} تومان</dd>
                </div>
              </div>
              {deal.stage && (
                <div className="flex items-center gap-3">
                  <dt className="text-xs text-muted-foreground">مرحله</dt>
                  <dd>{deal.stage.name}</dd>
                </div>
              )}
              {deal.contact && (
                <div className="flex items-center gap-3">
                  <User className="size-5 text-muted-foreground shrink-0" aria-hidden />
                  <div>
                    <dt className="text-xs text-muted-foreground">مخاطب</dt>
                    <dd>
                      <Link to={`${base}/contacts/${deal.contact.id}`} className="font-medium text-primary hover:underline">
                        {deal.contact.fullName}
                      </Link>
                    </dd>
                  </div>
                </div>
              )}
              {deal.company && (
                <div className="flex items-center gap-3">
                  <Building2 className="size-5 text-muted-foreground shrink-0" aria-hidden />
                  <div>
                    <dt className="text-xs text-muted-foreground">شرکت</dt>
                    <dd>
                      <Link to={`${base}/companies/${deal.company.id}`} className="font-medium text-primary hover:underline">
                        {deal.company.name}
                      </Link>
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          </div>

          <Link
            to={`${base}/deals`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-input bg-transparent px-4 py-2 font-medium transition-colors hover:bg-muted"
          >
            <ArrowRight className="size-4" aria-hidden />
            برگشت به معاملات
          </Link>
        </>
      ) : null}
    </div>
  );
}
