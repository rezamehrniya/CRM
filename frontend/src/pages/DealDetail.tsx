/**
 * صفحهٔ جزئیات فاکتور — عنوان، مبلغ، وضعیت مرحله‌ای، لینک مخاطب/شرکت.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, HandCoins, User, Building2, ArrowRight, FileCheck2, SendHorizontal } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { formatFaCurrency, formatFaNum } from '@/lib/numbers';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorPage } from '@/components/error-page';
import { Button } from '@/components/ui/button';

type DealDetailData = {
  id: string;
  title: string;
  subtotal?: unknown;
  discountAmount?: unknown;
  taxAmount?: unknown;
  amount?: unknown;
  stage?: { id: string; name: string };
  pipeline?: { id: string; name: string };
  contact?: { id: string; firstName: string; lastName: string } | null;
  company?: { id: string; name: string } | null;
  items?: Array<{
    id: string;
    productCode?: string | null;
    productName: string;
    unit?: string | null;
    quantity: string | number;
    unitPrice: string | number;
    discountPct?: string | number;
    taxPct?: string | number;
    lineSubtotal?: string | number;
    lineDiscountAmount?: string | number;
    lineTaxAmount?: string | number;
    lineTotal?: string | number;
  }>;
};

type DealInvoiceListItem = {
  id: string;
  status: string;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  totalAmount: number;
  itemsCount: number;
  sourceDealId: string | null;
  sourceDealTitle: string | null;
};

type DealInvoicesResponse = {
  data: DealInvoiceListItem[];
  total: number;
  page: number;
  pageSize: number;
};

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStageName(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase();
}

function isSentQuoteStageName(stageName: string | null | undefined) {
  const normalized = normalizeStageName(stageName);
  return (
    normalized.includes('ارسال') ||
    normalized.includes('پیش') ||
    normalized.includes('quote') ||
    normalized.includes('proforma') ||
    normalized.includes('sent')
  );
}

function isInvoiceStageName(stageName: string | null | undefined) {
  const normalized = normalizeStageName(stageName);
  return (
    normalized.includes('فاکتور') ||
    normalized.includes('invoice') ||
    normalized.includes('issued') ||
    normalized.includes('won') ||
    normalized.includes('contract') ||
    normalized.includes('بسته')
  );
}

function docTypeLabel(stageName: string | null | undefined) {
  return isInvoiceStageName(stageName) ? 'فاکتور' : 'پیش‌فاکتور';
}

function invoiceStatusLabel(status: string | null | undefined) {
  const normalized = String(status ?? '').trim().toUpperCase();
  if (normalized === 'PAID') return 'پرداخت‌شده';
  if (normalized === 'ISSUED') return 'صادرشده';
  if (normalized === 'DRAFT') return 'پیش‌نویس';
  return normalized || 'نامشخص';
}

function invoiceStatusTone(status: string | null | undefined) {
  const normalized = String(status ?? '').trim().toUpperCase();
  if (normalized === 'PAID') return 'bg-emerald-500/10 text-emerald-700';
  if (normalized === 'ISSUED') return 'bg-sky-500/10 text-sky-700';
  if (normalized === 'DRAFT') return 'bg-amber-500/10 text-amber-700';
  return 'bg-slate-500/10 text-slate-700';
}

export default function DealDetail() {
  const { tenantSlug, id } = useParams<{ tenantSlug: string; id: string }>();
  const base = `/t/${tenantSlug}/app`;
  const [deal, setDeal] = useState<DealDetailData | null>(null);
  const [relatedInvoices, setRelatedInvoices] = useState<DealInvoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<'send' | 'invoice' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadDeal = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setInvoicesLoading(true);
    setError(null);
    try {
      const [dealRes, invoiceRes] = await Promise.all([
        apiGet<DealDetailData>(`/quotes/${id}`),
        apiGet<DealInvoicesResponse>(`/quotes/invoices?dealId=${id}&page=1&pageSize=20`).catch(
          () =>
            ({
              data: [],
              total: 0,
              page: 1,
              pageSize: 20,
            }) as DealInvoicesResponse,
        ),
      ]);
      setDeal(dealRes);
      setRelatedInvoices(Array.isArray(invoiceRes.data) ? invoiceRes.data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setLoading(false);
      setInvoicesLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadDeal();
  }, [loadDeal]);

  if (!id) {
    return (
      <ErrorPage
        variant="404"
        title="فاکتور یافت نشد"
        description="شناسهٔ رکورد معتبر نیست."
        actionHref={`${base}/quotes`}
        actionLabel="برگشت به فاکتورها"
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
          <Link to={`${base}/quotes`}>فاکتورها</Link>
        </nav>
        <ErrorPage
          variant="404"
          title="فاکتور یافت نشد"
          description={error}
          actionHref={`${base}/quotes`}
          actionLabel="برگشت به فاکتورها"
          inline
        />
      </div>
    );
  }

  const lines = deal?.items ?? [];
  const subtotal = toNumber(deal?.subtotal);
  const discountAmount = toNumber(deal?.discountAmount);
  const taxAmount = toNumber(deal?.taxAmount);
  const grandTotal = toNumber(deal?.amount);
  const stageName = deal?.stage?.name;
  const isInvoice = isInvoiceStageName(stageName);
  const isQuoteSent = isSentQuoteStageName(stageName);

  const handleSendQuote = async () => {
    if (!id) return;
    setActionBusy('send');
    setActionError(null);
    try {
      await apiPost(`/quotes/${id}/send`);
      await loadDeal();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'خطا در ارسال پیش‌فاکتور');
    } finally {
      setActionBusy(null);
    }
  };

  const handleConvertToInvoice = async () => {
    if (!id) return;
    setActionBusy('invoice');
    setActionError(null);
    try {
      await apiPost(`/quotes/${id}/convert-to-invoice`);
      await loadDeal();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'خطا در تبدیل به فاکتور');
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-1" aria-label="مسیر">
        <Link to={base} className="hover:text-foreground transition-colors">
          پنل
        </Link>
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        <Link to={`${base}/quotes`} className="hover:text-foreground transition-colors">
          پیش‌فاکتورها و فاکتورها
        </Link>
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        <span className="text-foreground font-medium truncate max-w-[180px]">
          {loading ? '…' : deal?.title ?? 'سند'}
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
                  <p className="text-sm text-muted-foreground">رکورد {docTypeLabel(stageName)}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleSendQuote()}
                  disabled={loading || actionBusy !== null || isQuoteSent || isInvoice}
                  className="gap-2"
                >
                  <SendHorizontal className="size-4" />
                  ارسال پیش‌فاکتور
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleConvertToInvoice()}
                  disabled={loading || actionBusy !== null || isInvoice}
                  className="gap-2"
                >
                  <FileCheck2 className="size-4" />
                  تبدیل به فاکتور
                </Button>
                <Link
                  to={`${base}/quotes`}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-input bg-transparent px-4 py-2 font-medium transition-colors hover:bg-muted"
                >
                  برگشت به لیست
                </Link>
              </div>
            </div>

            {actionError && (
              <div className="mt-4 rounded-xl border border-rose-300 bg-rose-500/5 px-3 py-2 text-sm text-rose-600">
                {actionError}
              </div>
            )}

            <dl className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                <HandCoins className="size-5 text-muted-foreground shrink-0" aria-hidden />
                <div>
                  <dt className="text-xs text-muted-foreground">مبلغ</dt>
                  <dd className="font-medium fa-num">{formatFaCurrency(deal.amount as string | number | null | undefined)}</dd>
                </div>
              </div>
              {deal.stage && (
                <div className="flex items-center gap-3">
                  <dt className="text-xs text-muted-foreground">مرحله</dt>
                  <dd className="flex items-center gap-2">
                    <span>{deal.stage.name}</span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        isInvoice ? 'bg-emerald-500/12 text-emerald-700' : 'bg-sky-500/12 text-sky-700'
                      }`}
                    >
                      {docTypeLabel(stageName)}
                    </span>
                  </dd>
                </div>
              )}
              {deal.contact && (
                <div className="flex items-center gap-3">
                  <User className="size-5 text-muted-foreground shrink-0" aria-hidden />
                  <div>
                    <dt className="text-xs text-muted-foreground">مخاطب</dt>
                    <dd>
                      <Link to={`${base}/contacts/${deal.contact.id}`} className="font-medium text-primary hover:underline">
                        {[deal.contact.firstName, deal.contact.lastName].filter(Boolean).join(' ').trim() || '—'}
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

            <div className="mt-6 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">ریز اقلام سند</h2>
              {lines.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  برای این سند قلم محصول ثبت نشده است.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="h-10 border-b border-[var(--border-default)] bg-[var(--bg-toolbar)]">
                        <th className="px-3 text-start">محصول</th>
                        <th className="px-3 text-start">کد</th>
                        <th className="px-3 text-start">واحد</th>
                        <th className="px-3 text-start">تعداد</th>
                        <th className="px-3 text-start">قیمت واحد</th>
                        <th className="px-3 text-start">تخفیف٪</th>
                        <th className="px-3 text-start">مالیات٪</th>
                        <th className="px-3 text-start">جمع ردیف</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => (
                        <tr key={line.id} className="border-b border-[var(--border-default)]">
                          <td className="px-3 py-2">{line.productName}</td>
                          <td className="px-3 py-2">{line.productCode ?? '-'}</td>
                          <td className="px-3 py-2">{line.unit ?? '-'}</td>
                          <td className="px-3 py-2 fa-num">{formatFaNum(toNumber(line.quantity))}</td>
                          <td className="px-3 py-2 fa-num">{formatFaCurrency(toNumber(line.unitPrice))}</td>
                          <td className="px-3 py-2 fa-num">{toNumber(line.discountPct)}%</td>
                          <td className="px-3 py-2 fa-num">{toNumber(line.taxPct)}%</td>
                          <td className="px-3 py-2 fa-num font-medium">{formatFaCurrency(toNumber(line.lineTotal))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card/40 p-3 md:grid-cols-4">
                <div className="text-xs">
                  <div className="text-muted-foreground">جمع قبل از تخفیف</div>
                  <div className="fa-num font-semibold">{formatFaCurrency(subtotal)}</div>
                </div>
                <div className="text-xs">
                  <div className="text-muted-foreground">تخفیف</div>
                  <div className="fa-num font-semibold">{formatFaCurrency(discountAmount)}</div>
                </div>
                <div className="text-xs">
                  <div className="text-muted-foreground">مالیات</div>
                  <div className="fa-num font-semibold">{formatFaCurrency(taxAmount)}</div>
                </div>
                <div className="text-xs">
                  <div className="text-muted-foreground">جمع نهایی</div>
                  <div className="fa-num font-bold text-primary">{formatFaCurrency(grandTotal)}</div>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">فاکتورهای صادرشده از این پیش‌فاکتور</h2>
              {invoicesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                </div>
              ) : relatedInvoices.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  هنوز فاکتوری برای این سند صادر نشده است.
                </div>
              ) : (
                <div className="space-y-2">
                  {relatedInvoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="fa-num text-xs text-muted-foreground">#{invoice.id}</p>
                        <p className="text-sm font-medium text-foreground">
                          تاریخ صدور:{' '}
                          {invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString('fa-IR') : '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          اقلام: {formatFaNum(invoice.itemsCount)} | سررسید:{' '}
                          {invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString('fa-IR') : '—'}
                        </p>
                      </div>
                      <div className="text-left">
                        <span
                          className={`mb-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${invoiceStatusTone(invoice.status)}`}
                        >
                          {invoiceStatusLabel(invoice.status)}
                        </span>
                        <p className="fa-num text-sm font-semibold">{formatFaCurrency(invoice.totalAmount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Link
            to={`${base}/quotes`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-input bg-transparent px-4 py-2 font-medium transition-colors hover:bg-muted"
          >
            <ArrowRight className="size-4" aria-hidden />
            برگشت به پیش‌فاکتورها و فاکتورها
          </Link>
        </>
      ) : null}
    </div>
  );
}

