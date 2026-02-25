/**
 * صفحهٔ معاملات — لیست، جستجو، صفحه‌بندی، ایجاد/ویرایش/حذف.
 */
import { useMemo, useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { formatFaCurrency, formatFaNum } from '@/lib/numbers';
import { PageBreadcrumb } from '@/components/PageBreadcrumb';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, FileCheck2, Loader2, Pencil, Plus, SendHorizontal, Trash2 } from 'lucide-react';

type PipelineStage = { id: string; name: string; order: number };
type Pipeline = { id: string; name: string; isDefault?: boolean; stages: PipelineStage[] };
type StageWithPipeline = PipelineStage & { pipelineId: string };

type ProductOption = {
  code: string;
  name: string;
  unit: string;
  basePrice: number;
  category?: string | null;
  isActive: boolean;
};

type DealLine = {
  id?: string;
  productCode?: string | null;
  productName: string;
  unit?: string | null;
  quantity: string | number;
  unitPrice: string | number;
  discountPct?: string | number;
  taxPct?: string | number;
  lineTotal?: string | number;
};

type Deal = {
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
  items?: DealLine[];
  _count?: { items: number };
};

type EditableLine = {
  rowId: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  discountPct: string;
  taxPct: string;
};

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createLine(seed = ''): EditableLine {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    rowId: `${seed}${suffix}`,
    productCode: '',
    productName: '',
    unit: 'عدد',
    quantity: '1',
    unitPrice: '0',
    discountPct: '0',
    taxPct: '0',
  };
}

function lineMath(line: EditableLine) {
  const quantity = Math.max(0, toNumber(line.quantity));
  const unitPrice = Math.max(0, toNumber(line.unitPrice));
  const discountPct = Math.min(100, Math.max(0, toNumber(line.discountPct)));
  const taxPct = Math.min(100, Math.max(0, toNumber(line.taxPct)));

  const lineSubtotal = Math.round(quantity * unitPrice);
  const lineDiscountAmount = Math.round((lineSubtotal * discountPct) / 100);
  const taxableBase = Math.max(0, lineSubtotal - lineDiscountAmount);
  const lineTaxAmount = Math.round((taxableBase * taxPct) / 100);
  const lineTotal = taxableBase + lineTaxAmount;

  return { lineSubtotal, lineDiscountAmount, lineTaxAmount, lineTotal };
}

function linesSummary(lines: EditableLine[]) {
  return lines.reduce(
    (acc, line) => {
      const calc = lineMath(line);
      acc.subtotal += calc.lineSubtotal;
      acc.discountAmount += calc.lineDiscountAmount;
      acc.taxAmount += calc.lineTaxAmount;
      acc.amount += calc.lineTotal;
      return acc;
    },
    { subtotal: 0, discountAmount: 0, taxAmount: 0, amount: 0 },
  );
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

export default function Deals() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/t/${tenantSlug}/app`;
  const [data, setData] = useState<{ data: Deal[]; total: number; page: number; pageSize: number } | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    amount: '',
    stageId: '',
    pipelineId: '',
    lines: [createLine('initial-')] as EditableLine[],
  });
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [rowActionId, setRowActionId] = useState<string | null>(null);
  const [rowActionType, setRowActionType] = useState<'send' | 'invoice' | null>(null);

  const pageSize = 25;

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (q.trim()) params.set('q', q.trim());
    Promise.all([
      apiGet<{ data: Deal[]; total: number; page: number; pageSize: number }>(`/quotes?${params}`),
      apiGet<Pipeline[]>('/pipelines'),
      apiGet<{ data: ProductOption[] }>('/products?page=1&pageSize=500').catch(() => ({ data: [] })),
    ])
      .then(([dealsRes, pipes, productRes]) => {
        setData({ ...dealsRes, page, pageSize: dealsRes.pageSize ?? pageSize });
        setPipelines(pipes ?? []);
        setProducts((productRes.data ?? []).filter((item) => item.isActive !== false));
      })
      .catch((e) => setError(e?.message ?? 'خطا'))
      .finally(() => setLoading(false));
  }, [page, q]);

  const refetch = () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (q.trim()) params.set('q', q.trim());
    apiGet<{ data: Deal[]; total: number }>(`/quotes?${params}`).then((res) =>
      setData({ ...res, page, pageSize })
    );
  };

  const stages: StageWithPipeline[] = pipelines.flatMap((p) =>
    p.stages.map((s) => ({ ...s, pipelineId: p.id }))
  );
  const defaultPipeline = pipelines.find((p) => p.isDefault) ?? pipelines[0];
  const defaultStage = defaultPipeline?.stages?.[0];

  const handleCreate = () => {
    setDrawerId(null);
    setForm({
      title: '',
      amount: '',
      stageId: defaultStage?.id ?? '',
      pipelineId: defaultPipeline?.id ?? '',
      lines: [createLine('new-')],
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setDrawerId(null);
    setFormOpen(false);
    setLoadingDetail(false);
    setForm({ title: '', amount: '', stageId: '', pipelineId: '', lines: [createLine('close-')] });
  };

  const setLineField = (rowId: string, field: keyof EditableLine, value: string) => {
    setForm((previous) => ({
      ...previous,
      lines: previous.lines.map((line) => (line.rowId === rowId ? { ...line, [field]: value } : line)),
    }));
  };

  const handleProductSelect = (rowId: string, code: string) => {
    const product = products.find((item) => item.code === code);
    setForm((previous) => ({
      ...previous,
      lines: previous.lines.map((line) => {
        if (line.rowId !== rowId) return line;
        if (!product) return { ...line, productCode: code };
        return {
          ...line,
          productCode: product.code,
          productName: product.name,
          unit: product.unit || line.unit,
          unitPrice: String(Math.round(toNumber(product.basePrice))),
        };
      }),
    }));
  };

  const addLine = () => setForm((previous) => ({ ...previous, lines: [...previous.lines, createLine('row-')] }));

  const removeLine = (rowId: string) =>
    setForm((previous) => {
      const next = previous.lines.filter((line) => line.rowId !== rowId);
      return { ...previous, lines: next.length > 0 ? next : [createLine('row-')] };
    });

  const buildPayloadItems = () =>
    form.lines
      .map((line) => ({
        productCode: line.productCode.trim() || undefined,
        productName: line.productName.trim(),
        unit: line.unit.trim() || undefined,
        quantity: toNumber(line.quantity),
        unitPrice: toNumber(line.unitPrice),
        discountPct: toNumber(line.discountPct),
        taxPct: toNumber(line.taxPct),
      }))
      .filter((line) => line.productName && line.quantity > 0);

  const handleSave = async () => {
    if (!form.title.trim() || !form.stageId || !form.pipelineId) return;
    const payloadItems = buildPayloadItems();
    if (payloadItems.length === 0) {
      setError('حداقل یک قلم معتبر برای سند وارد کنید.');
      return;
    }
    const summary = linesSummary(form.lines);
    setSaving(true);
    try {
      if (drawerId) {
        await apiPatch(`/quotes/${drawerId}`, {
          title: form.title,
          amount: summary.amount,
          stageId: form.stageId,
          pipelineId: form.pipelineId,
          items: payloadItems,
        });
        closeForm();
      } else {
        await apiPost('/quotes', {
          title: form.title,
          amount: summary.amount,
          stageId: form.stageId,
          pipelineId: form.pipelineId,
          items: payloadItems,
        });
        closeForm();
      }
      refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('حذف این معامله؟')) return;
    setSaving(true);
    try {
      await apiDelete(`/quotes/${id}`);
      closeForm();
      refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setSaving(false);
    }
  };

  const handleSendQuote = async (id: string) => {
    setRowActionId(id);
    setRowActionType('send');
    setError(null);
    try {
      await apiPost(`/quotes/${id}/send`);
      refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا در ارسال پیش‌فاکتور');
    } finally {
      setRowActionId(null);
      setRowActionType(null);
    }
  };

  const handleConvertToInvoice = async (id: string) => {
    setRowActionId(id);
    setRowActionType('invoice');
    setError(null);
    try {
      await apiPost(`/quotes/${id}/convert-to-invoice`);
      refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا در تبدیل به فاکتور');
    } finally {
      setRowActionId(null);
      setRowActionType(null);
    }
  };

  const formatAmount = (v: unknown) => formatFaCurrency(v == null ? 0 : Number(v));
  const summary = useMemo(() => linesSummary(form.lines), [form.lines]);

  return (
    <div className="space-y-5">
      <PageBreadcrumb current="پیش‌فاکتور و فاکتور" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-title-lg font-title">پیش‌فاکتور و فاکتور</h1>
        <div className="flex gap-2">
          <Input
            type="search"
            placeholder="جستجو..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-48 bg-card"
          />
          <Button type="button" onClick={handleCreate} disabled={pipelines.length === 0} className="whitespace-nowrap">
            سند جدید
          </Button>
        </div>
      </div>

      {error && (
        <Alert className="rounded-card border-destructive/30 bg-destructive/10 text-destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="glass-table-surface overflow-x-auto rounded-card">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-[var(--border-default)] h-11 bg-[var(--bg-toolbar)]">
                <th className="text-start pe-4 ps-4 font-medium">عنوان</th>
                <th className="text-start pe-4 ps-4 font-medium">مرحله</th>
                <th className="text-start pe-4 ps-4 font-medium">اقلام</th>
                <th className="text-start pe-4 ps-4 font-medium">مبلغ</th>
                <th className="text-start pe-4 ps-4 w-20">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b border-[var(--border-default)] h-12">
                  <td className="pe-4 ps-4"><Skeleton className="h-4 w-36" /></td>
                  <td className="pe-4 ps-4"><Skeleton className="h-4 w-24" /></td>
                  <td className="pe-4 ps-4"><Skeleton className="h-4 w-12" /></td>
                  <td className="pe-4 ps-4"><Skeleton className="h-4 w-20" /></td>
                  <td className="pe-4 ps-4"><Skeleton className="h-8 w-16" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && data && (
        <>
          <div className="glass-table-surface overflow-x-auto rounded-card">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-[var(--border-default)] h-11 bg-[var(--bg-toolbar)]">
                  <th className="text-start pe-4 ps-4 font-medium">عنوان</th>
                  <th className="text-start pe-4 ps-4 font-medium">مرحله</th>
                  <th className="text-start pe-4 ps-4 font-medium">اقلام</th>
                  <th className="text-start pe-4 ps-4 font-medium">مبلغ</th>
                  <th className="text-start pe-4 ps-4 w-20">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {data.data.length === 0 && (
                    <tr>
                    <td colSpan={5} className="pe-4 ps-4 py-8 text-center text-muted-foreground">
                      معامله‌ای یافت نشد.
                    </td>
                  </tr>
                )}
                {data.data.map((d) => (
                  <tr key={d.id} className="border-b border-[var(--border-default)] h-12 hover:bg-[var(--bg-muted)]">
                    <td className="pe-4 ps-4">
                      <Link to={`${base}/quotes/${d.id}`} className="font-medium text-primary hover:underline">
                        {d.title}
                      </Link>
                    </td>
                    <td className="pe-4 ps-4">
                      <div className="flex flex-col gap-1">
                        <span>{d.stage?.name ?? '—'}</span>
                        <span
                          className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            isInvoiceStageName(d.stage?.name)
                              ? 'bg-emerald-500/12 text-emerald-700'
                              : 'bg-sky-500/12 text-sky-700'
                          }`}
                        >
                          {docTypeLabel(d.stage?.name)}
                        </span>
                      </div>
                    </td>
                    <td className="pe-4 ps-4 fa-num">{formatFaNum(d._count?.items ?? d.items?.length ?? 0)}</td>
                    <td className="pe-4 ps-4 fa-num">{formatAmount(d.amount)}</td>
                    <td className="pe-4 ps-4 flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => void handleSendQuote(d.id)}
                        disabled={
                          saving ||
                          (rowActionId === d.id && rowActionType === 'send') ||
                          isSentQuoteStageName(d.stage?.name) ||
                          isInvoiceStageName(d.stage?.name)
                        }
                        aria-label="ارسال پیش‌فاکتور"
                        title="ارسال پیش‌فاکتور"
                      >
                        <SendHorizontal className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => void handleConvertToInvoice(d.id)}
                        disabled={
                          saving ||
                          (rowActionId === d.id && rowActionType === 'invoice') ||
                          isInvoiceStageName(d.stage?.name)
                        }
                        aria-label="تبدیل به فاکتور"
                        title="تبدیل به فاکتور"
                      >
                        <FileCheck2 className="size-4" />
                      </Button>
                      <Link to={`${base}/quotes/${d.id}`} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-[var(--bg-muted)]" aria-label="مشاهده" title="مشاهده">
                        <Eye className="size-4" />
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={async () => {
                          setDrawerId(d.id);
                          setFormOpen(true);
                          setLoadingDetail(true);
                          try {
                            const detail = await apiGet<Deal>(`/quotes/${d.id}`);
                            const lines =
                              (detail.items ?? []).length > 0
                                ? (detail.items ?? []).map((item) => ({
                                    rowId: item.id ?? createLine('existing-').rowId,
                                    productCode: String(item.productCode ?? ''),
                                    productName: String(item.productName ?? ''),
                                    unit: String(item.unit ?? 'عدد'),
                                    quantity: String(item.quantity ?? '1'),
                                    unitPrice: String(item.unitPrice ?? '0'),
                                    discountPct: String(item.discountPct ?? '0'),
                                    taxPct: String(item.taxPct ?? '0'),
                                  }))
                                : [
                                    {
                                      ...createLine('fallback-'),
                                      productName: detail.title,
                                      unit: 'مورد',
                                      quantity: '1',
                                      unitPrice: String(Math.max(0, Math.round(toNumber(detail.amount)))),
                                    },
                                  ];

                            setForm({
                              title: detail.title,
                              amount: detail.amount != null ? String(detail.amount) : '',
                              stageId: detail.stage?.id ?? '',
                              pipelineId: detail.pipeline?.id ?? '',
                              lines,
                            });
                          } catch (e: unknown) {
                            setError(e instanceof Error ? e.message : 'خطا در دریافت جزئیات');
                            closeForm();
                          } finally {
                            setLoadingDetail(false);
                          }
                        }}
                        aria-label="ویرایش"
                        title="ویرایش"
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.total > pageSize && (
            <div className="mt-4 flex justify-between items-center">
              <span className="text-sm text-muted-foreground fa-num">
                {formatFaNum(data.data.length)} از {formatFaNum(data.total)}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  قبلی
                </Button>
                <Button variant="outline" size="sm" disabled={page * pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>
                  بعدی
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {formOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
          onClick={closeForm}
          onKeyDown={(e) => e.key === 'Escape' && closeForm()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="deal-form-title"
        >
          <div className="glass-card w-full max-w-6xl p-6 rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 id="deal-form-title" className="text-lg font-semibold mb-4">{drawerId ? 'ویرایش معامله' : 'معامله جدید'}</h2>
            {loadingDetail && (
              <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                در حال دریافت اطلاعات...
              </div>
            )}
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="deal-title">عنوان</Label>
                  <Input
                    id="deal-title"
                    type="text"
                    placeholder="عنوان"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="bg-card"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deal-stage">مرحله</Label>
                  <select
                    id="deal-stage"
                    value={form.stageId}
                    onChange={(e) => {
                      const stage = stages.find((s) => s.id === e.target.value);
                      setForm((f) => ({
                        ...f,
                        stageId: e.target.value,
                        pipelineId: stage?.pipelineId ?? f.pipelineId,
                      }));
                    }}
                    className="w-full h-10 rounded-xl border border-input bg-card px-3"
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {pipelines.find((p) => p.id === s.pipelineId)?.name ?? ''} — {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="h-10 border-b border-[var(--border-default)] bg-[var(--bg-toolbar)]">
                      <th className="px-2 text-start">محصول</th>
                      <th className="px-2 text-start">شرح</th>
                      <th className="px-2 text-start">واحد</th>
                      <th className="px-2 text-start">تعداد</th>
                      <th className="px-2 text-start">قیمت واحد</th>
                      <th className="px-2 text-start">تخفیف٪</th>
                      <th className="px-2 text-start">مالیات٪</th>
                      <th className="px-2 text-start">جمع ردیف</th>
                      <th className="px-2 text-start">حذف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.lines.map((line) => {
                      const calc = lineMath(line);
                      return (
                        <tr key={line.rowId} className="border-b border-[var(--border-default)]">
                          <td className="px-2 py-2">
                            <select
                              value={line.productCode}
                              onChange={(e) => handleProductSelect(line.rowId, e.target.value)}
                              className="h-9 w-full rounded-lg border border-input bg-card px-2 text-xs"
                            >
                              <option value="">انتخاب محصول</option>
                              {products.map((product) => (
                                <option key={product.code} value={product.code}>
                                  {product.name} ({product.code})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              value={line.productName}
                              onChange={(e) => setLineField(line.rowId, 'productName', e.target.value)}
                              className="h-9 bg-card"
                              placeholder="شرح قلم"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input value={line.unit} onChange={(e) => setLineField(line.rowId, 'unit', e.target.value)} className="h-9 bg-card" />
                          </td>
                          <td className="px-2 py-2">
                            <Input value={line.quantity} onChange={(e) => setLineField(line.rowId, 'quantity', e.target.value)} className="h-9 bg-card" type="number" min="0" step="0.001" />
                          </td>
                          <td className="px-2 py-2">
                            <Input value={line.unitPrice} onChange={(e) => setLineField(line.rowId, 'unitPrice', e.target.value)} className="h-9 bg-card" type="number" min="0" step="1" />
                          </td>
                          <td className="px-2 py-2">
                            <Input value={line.discountPct} onChange={(e) => setLineField(line.rowId, 'discountPct', e.target.value)} className="h-9 bg-card" type="number" min="0" max="100" step="0.01" />
                          </td>
                          <td className="px-2 py-2">
                            <Input value={line.taxPct} onChange={(e) => setLineField(line.rowId, 'taxPct', e.target.value)} className="h-9 bg-card" type="number" min="0" max="100" step="0.01" />
                          </td>
                          <td className="px-2 py-2 fa-num">{formatFaCurrency(calc.lineTotal)}</td>
                          <td className="px-2 py-2">
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(line.rowId)}>
                              <Trash2 className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1">
                  <Plus className="size-4" />
                  افزودن قلم
                </Button>
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card/40 p-3 md:grid-cols-4">
                  <div className="text-xs">
                    <div className="text-muted-foreground">جمع قبل از تخفیف</div>
                    <div className="fa-num font-semibold">{formatFaCurrency(summary.subtotal)}</div>
                  </div>
                  <div className="text-xs">
                    <div className="text-muted-foreground">تخفیف</div>
                    <div className="fa-num font-semibold">{formatFaCurrency(summary.discountAmount)}</div>
                  </div>
                  <div className="text-xs">
                    <div className="text-muted-foreground">مالیات</div>
                    <div className="fa-num font-semibold">{formatFaCurrency(summary.taxAmount)}</div>
                  </div>
                  <div className="text-xs">
                    <div className="text-muted-foreground">جمع نهایی</div>
                    <div className="fa-num font-bold text-primary">{formatFaCurrency(summary.amount)}</div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-2 justify-end">
                {drawerId && (
                  <Button type="button" variant="destructive" onClick={() => handleDelete(drawerId)} disabled={saving} aria-label="حذف" title="حذف" className="gap-2">
                    <Trash2 className="size-4" />
                    حذف
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={closeForm}>انصراف</Button>
                <Button type="button" onClick={handleSave} disabled={saving || !form.title.trim() || !form.stageId}>
                  {saving ? 'در حال ذخیره...' : 'ذخیره'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
