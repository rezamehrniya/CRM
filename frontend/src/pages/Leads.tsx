/**
 * صفحهٔ لیدها — لیست، جستجو، صفحه‌بندی، ایجاد/ویرایش/حذف.
 * شامل تاریخ پیگیری (followUpAt).
 */
import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { formatFaNum, digitsToFa } from '@/lib/numbers';
import { PageBreadcrumb } from '@/components/PageBreadcrumb';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { JalaliDate } from '@/components/ui/jalali-date';
import { JalaliDateInput } from '@/components/ui/jalali-date-input';
import { useAuth } from '@/contexts/auth-context';
import { Pencil, Trash2 } from 'lucide-react';
import { useCallback, useMemo } from 'react';

type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  companyName?: string | null;
  source?: string | null;
  status: string;
  notes?: string | null;
  followUpAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function leadFullName(l: { firstName: string; lastName: string }): string {
  return [l.firstName, l.lastName].filter(Boolean).join(' ').trim() || '—';
}

const STATUS_OPTIONS = [
  { value: 'NEW', label: 'جدید' },
  { value: 'CONTACTED', label: 'تماس گرفته‌شده' },
  { value: 'QUALIFIED', label: 'واجد شرایط' },
  { value: 'CONVERTED', label: 'تبدیل‌شده' },
  { value: 'LOST', label: 'از دست رفته' },
];

const SOURCE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'سایت', label: 'سایت' },
  { value: 'تبلیغ', label: 'تبلیغ' },
  { value: 'تماس', label: 'تماس' },
  { value: 'ارجاع', label: 'ارجاع' },
  { value: 'سایر', label: 'سایر' },
];

const STATUS_THEME: Record<string, { bg: string; bar: string }> = {
  NEW: { bg: 'bg-sky-100', bar: 'bg-sky-600' },
  CONTACTED: { bg: 'bg-amber-100', bar: 'bg-amber-600' },
  QUALIFIED: { bg: 'bg-indigo-100', bar: 'bg-indigo-600' },
  CONVERTED: { bg: 'bg-emerald-100', bar: 'bg-emerald-600' },
  LOST: { bg: 'bg-rose-100', bar: 'bg-rose-600' },
};

function isClosedStatus(status: string) {
  return status === 'CONVERTED' || status === 'LOST';
}

export default function Leads() {
  const { hasPermission } = useAuth();
  const canManageLeads = hasPermission('leads.manage');
  const [data, setData] = useState<{
    data: Lead[];
    total: number;
    page: number;
    pageSize: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'list'>(canManageLeads ? 'overview' : 'list');
  const [drawer, setDrawer] = useState<Lead | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewLeads, setOverviewLeads] = useState<Lead[]>([]);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    companyName: '',
    source: '',
    status: 'NEW',
    notes: '',
    followUpAt: '',
  });
  const [saving, setSaving] = useState(false);

  const pageSize = 25;

  useEffect(() => {
    if (!canManageLeads && activeTab === 'overview') {
      setActiveTab('list');
    }
  }, [canManageLeads, activeTab]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (q.trim()) params.set('q', q.trim());
    if (statusFilter) params.set('status', statusFilter);
    apiGet<{ data: Lead[]; total: number; page: number; pageSize: number }>(`/leads?${params}`)
      .then((res) => setData({ ...res, page, pageSize: res.pageSize ?? pageSize }))
      .catch((e) => setError(e?.message ?? 'خطا'))
      .finally(() => setLoading(false));
  }, [page, q, statusFilter]);

  const refetch = () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (q.trim()) params.set('q', q.trim());
    if (statusFilter) params.set('status', statusFilter);
    apiGet<{ data: Lead[]; total: number }>(`/leads?${params}`).then((res) =>
      setData({ ...res, page, pageSize })
    );
  };

  const fetchOverview = useCallback(async () => {
    if (!canManageLeads) return;
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const all: Lead[] = [];
      const fetchPageSize = 200;
      let cursorPage = 1;
      let total = 0;
      do {
        const params = new URLSearchParams({
          page: String(cursorPage),
          pageSize: String(fetchPageSize),
        });
        const res = await apiGet<{ data: Lead[]; total: number }>(`/leads?${params}`);
        total = res.total ?? 0;
        all.push(...(res.data ?? []));
        cursorPage += 1;
      } while (all.length < total && cursorPage <= 20);
      setOverviewLeads(all);
    } catch (e) {
      setOverviewError(e instanceof Error ? e.message : 'خطا در دریافت نمای کلی لیدها');
    } finally {
      setOverviewLoading(false);
    }
  }, [canManageLeads]);

  useEffect(() => {
    if (canManageLeads) {
      void fetchOverview();
    }
  }, [canManageLeads, fetchOverview]);

  const handleCreate = () => {
    setDrawer(null);
    setForm({
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      companyName: '',
      source: '',
      status: 'NEW',
      notes: '',
      followUpAt: '',
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setDrawer(null);
    setFormOpen(false);
    setForm({
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      companyName: '',
      source: '',
      status: 'NEW',
      notes: '',
      followUpAt: '',
    });
  };

  const handleSave = async () => {
    if (!form.firstName.trim() && !form.lastName.trim()) return;
    setSaving(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        companyName: form.companyName.trim() || undefined,
        source: form.source.trim() || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
        followUpAt: form.followUpAt ? form.followUpAt : undefined,
      };
      if (drawer) {
        await apiPatch(`/leads/${drawer.id}`, payload);
        closeForm();
      } else {
        await apiPost('/leads', payload);
        setForm({ ...form, firstName: '', lastName: '', phone: '', email: '', companyName: '', source: '', notes: '', followUpAt: '' });
        setFormOpen(false);
      }
      refetch();
      if (canManageLeads) void fetchOverview();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('حذف این لید؟')) return;
    setSaving(true);
    try {
      await apiDelete(`/leads/${id}`);
      closeForm();
      refetch();
      if (canManageLeads) void fetchOverview();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = (s: string) => STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;

  const overviewStats = useMemo(() => {
    const leads = overviewLeads;
    const total = leads.length;
    const statusCounts = STATUS_OPTIONS.reduce<Record<string, number>>((acc, item) => {
      acc[item.value] = 0;
      return acc;
    }, {});
    const sourceCounts: Record<string, number> = {};
    let overdueFollowUps = 0;
    const now = Date.now();
    leads.forEach((lead) => {
      statusCounts[lead.status] = (statusCounts[lead.status] ?? 0) + 1;
      const sourceKey = lead.source?.trim() || 'بدون منبع';
      sourceCounts[sourceKey] = (sourceCounts[sourceKey] ?? 0) + 1;
      if (lead.followUpAt && !isClosedStatus(lead.status)) {
        const followUpTs = new Date(lead.followUpAt).getTime();
        if (!Number.isNaN(followUpTs) && followUpTs < now) overdueFollowUps += 1;
      }
    });
    const converted = statusCounts.CONVERTED ?? 0;
    const conversionRate = total > 0 ? (converted / total) * 100 : 0;
    const sortedSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);
    return { total, statusCounts, sourceCounts: sortedSources, overdueFollowUps, conversionRate };
  }, [overviewLeads]);

  return (
    <div className="space-y-5">
      <PageBreadcrumb current="لیدها" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-title-lg font-title">لیدها</h1>
        <div className="flex gap-2 flex-wrap">
          {canManageLeads && (
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-2">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  activeTab === 'overview'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-[var(--bg-muted)] text-muted-foreground hover:text-foreground'
                }`}
              >
                Overview لیدها
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  activeTab === 'list'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-[var(--bg-muted)] text-muted-foreground hover:text-foreground'
                }`}
              >
                لیست لیدها
              </button>
            </div>
          )}
          {(activeTab === 'list' || !canManageLeads) && (
            <>
              <Input
                type="search"
                placeholder="جستجو..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-48 bg-card"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-xl border border-input bg-card px-3 text-sm"
              >
                <option value="">همه وضعیت‌ها</option>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Button type="button" onClick={handleCreate} className="whitespace-nowrap">
                لید جدید
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <Alert className="rounded-card border-destructive/30 bg-destructive/10 text-destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {canManageLeads && activeTab === 'overview' && (
        <div className="space-y-4">
          {overviewError && (
            <Alert className="rounded-card border-destructive/30 bg-destructive/10 text-destructive">
              <AlertDescription>{overviewError}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-sky-100 px-4 py-3">
              <p className="text-xs text-sky-700">کل لیدها</p>
              <p className="fa-num mt-1 text-2xl font-black text-sky-900">{formatFaNum(overviewStats.total)}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 px-4 py-3">
              <p className="text-xs text-emerald-700">تبدیل‌شده</p>
              <p className="fa-num mt-1 text-2xl font-black text-emerald-900">
                {formatFaNum(overviewStats.statusCounts.CONVERTED ?? 0)}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 px-4 py-3">
              <p className="text-xs text-amber-700">نرخ تبدیل</p>
              <p className="fa-num mt-1 text-2xl font-black text-amber-900">{formatFaNum(overviewStats.conversionRate.toFixed(1))}%</p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-rose-100 px-4 py-3">
              <p className="text-xs text-rose-700">پیگیری عقب‌افتاده</p>
              <p className="fa-num mt-1 text-2xl font-black text-rose-900">{formatFaNum(overviewStats.overdueFollowUps)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold">قیف وضعیت لیدها</h3>
              <p className="mt-1 text-xs text-muted-foreground">نمای توزیع وضعیت‌ها با رنگ اختصاصی هر مرحله</p>
              <div className="mt-4 space-y-3">
                {STATUS_OPTIONS.map((item) => {
                  const count = overviewStats.statusCounts[item.value] ?? 0;
                  const width = overviewStats.total > 0 ? Math.max(8, Math.round((count / overviewStats.total) * 100)) : 0;
                  return (
                    <div key={item.value} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{item.label}</span>
                        <span className="fa-num text-muted-foreground">{formatFaNum(count)}</span>
                      </div>
                      <div className={`h-2 overflow-hidden rounded-full ${STATUS_THEME[item.value]?.bg ?? 'bg-slate-100'}`}>
                        <div
                          className={`h-full rounded-full ${STATUS_THEME[item.value]?.bar ?? 'bg-slate-600'}`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold">منابع لید</h3>
              <p className="mt-1 text-xs text-muted-foreground">منبع‌های ورودی لید به ترتیب بیشترین سهم</p>
              <div className="mt-4 space-y-2">
                {overviewLoading && <Skeleton className="h-24 w-full" />}
                {!overviewLoading && overviewStats.sourceCounts.length === 0 && (
                  <p className="text-sm text-muted-foreground">داده‌ای برای نمایش وجود ندارد.</p>
                )}
                {!overviewLoading &&
                  overviewStats.sourceCounts.map(([source, count]) => {
                    const width = overviewStats.total > 0 ? Math.max(10, Math.round((count / overviewStats.total) * 100)) : 0;
                    return (
                      <div key={source} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span>{source}</span>
                          <span className="fa-num text-muted-foreground">{formatFaNum(count)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-slate-700" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {(activeTab === 'list' || !canManageLeads) && loading && (
        <div className="glass-table-surface overflow-x-auto rounded-card">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-[var(--border-default)] h-11 bg-[var(--bg-toolbar)]">
                <th className="text-start pe-4 ps-4 font-medium">نام</th>
                <th className="text-start pe-4 ps-4 font-medium">نام خانوادگی</th>
                <th className="text-start pe-4 ps-4 font-medium">تلفن / ایمیل</th>
                <th className="text-start pe-4 ps-4 font-medium">شرکت</th>
                <th className="text-start pe-4 ps-4 font-medium">منبع</th>
                <th className="text-start pe-4 ps-4 font-medium">وضعیت</th>
                <th className="text-start pe-4 ps-4 font-medium">تاریخ پیگیری</th>
                <th className="text-start pe-4 ps-4 w-24">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b border-[var(--border-default)] h-12">
                  <td className="pe-4 ps-4"><Skeleton className="h-4 w-24" /></td>
                  <td className="pe-4 ps-4"><Skeleton className="h-4 w-24" /></td>
                  <td className="pe-4 ps-4"><Skeleton className="h-4 w-32" /></td>
                  <td className="pe-4 ps-4"><Skeleton className="h-4 w-24" /></td>
                  <td className="pe-4 ps-4"><Skeleton className="h-4 w-16" /></td>
                  <td className="pe-4 ps-4"><Skeleton className="h-4 w-20" /></td>
                  <td className="pe-4 ps-4"><Skeleton className="h-4 w-24" /></td>
                  <td className="pe-4 ps-4"><Skeleton className="h-8 w-20" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(activeTab === 'list' || !canManageLeads) && !loading && data && (
        <>
          <div className="glass-table-surface overflow-x-auto rounded-card">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-[var(--border-default)] h-11 bg-[var(--bg-toolbar)]">
                  <th className="text-start pe-4 ps-4 font-medium">نام</th>
                  <th className="text-start pe-4 ps-4 font-medium">نام خانوادگی</th>
                  <th className="text-start pe-4 ps-4 font-medium">تلفن / ایمیل</th>
                  <th className="text-start pe-4 ps-4 font-medium">شرکت</th>
                  <th className="text-start pe-4 ps-4 font-medium">منبع</th>
                  <th className="text-start pe-4 ps-4 font-medium">وضعیت</th>
                  <th className="text-start pe-4 ps-4 font-medium">تاریخ پیگیری</th>
                  <th className="text-start pe-4 ps-4 w-24">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={8} className="pe-4 ps-4 py-8 text-center text-muted-foreground">
                      لیدی یافت نشد.
                    </td>
                  </tr>
                )}
                {data.data.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-[var(--border-default)] h-12 hover:bg-[var(--bg-muted)]"
                  >
                    <td className="pe-4 ps-4 font-medium">{lead.firstName || '—'}</td>
                    <td className="pe-4 ps-4 font-medium">{lead.lastName || '—'}</td>
                    <td className="pe-4 ps-4 text-sm">
                      <span className="fa-num">{digitsToFa(lead.phone ?? '')}</span>
                      {lead.email ? ` / ${lead.email}` : ''}
                    </td>
                    <td className="pe-4 ps-4 text-sm">{lead.companyName ?? '—'}</td>
                    <td className="pe-4 ps-4 text-sm">{lead.source ?? '—'}</td>
                    <td className="pe-4 ps-4 text-sm">{statusLabel(lead.status)}</td>
                    <td className="pe-4 ps-4">
                      <JalaliDate value={lead.followUpAt} dateOnly />
                    </td>
                    <td className="pe-4 ps-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setDrawer(lead);
                          setFormOpen(true);
                          setForm({
                            firstName: lead.firstName,
                            lastName: lead.lastName,
                            phone: lead.phone ?? '',
                            email: lead.email ?? '',
                            companyName: lead.companyName ?? '',
                            source: lead.source ?? '',
                            status: lead.status,
                            notes: lead.notes ?? '',
                            followUpAt: lead.followUpAt ? lead.followUpAt.slice(0, 10) : '',
                          });
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  قبلی
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page * pageSize >= data.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  بعدی
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {formOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 overflow-y-auto py-6"
          onClick={closeForm}
          onKeyDown={(e) => e.key === 'Escape' && closeForm()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="lead-form-title"
        >
          <div
            className="glass-card w-full max-w-lg p-6 rounded-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="lead-form-title" className="text-lg font-semibold mb-4">
              {drawer ? `ویرایش لید: ${leadFullName(drawer)}` : 'لید جدید'}
            </h2>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="lead-firstName">نام</Label>
                  <Input
                    id="lead-firstName"
                    type="text"
                    placeholder="نام"
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="bg-card"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-lastName">نام خانوادگی</Label>
                  <Input
                    id="lead-lastName"
                    type="text"
                    placeholder="نام خانوادگی"
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    className="bg-card"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="lead-phone">تلفن</Label>
                  <Input
                    id="lead-phone"
                    type="text"
                    placeholder="تلفن"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="bg-card"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-email">ایمیل</Label>
                  <Input
                    id="lead-email"
                    type="email"
                    placeholder="ایمیل"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="bg-card"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-companyName">نام شرکت</Label>
                <Input
                  id="lead-companyName"
                  type="text"
                  placeholder="نام شرکت"
                  value={form.companyName}
                  onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                  className="bg-card"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="lead-source">منبع لید</Label>
                  <select
                    id="lead-source"
                    value={form.source}
                    onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                    className="w-full h-10 rounded-xl border border-input bg-card px-3 text-sm"
                  >
                    {SOURCE_OPTIONS.map((o) => (
                      <option key={o.value || 'empty'} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-status">وضعیت</Label>
                  <select
                    id="lead-status"
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full h-10 rounded-xl border border-input bg-card px-3 text-sm"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-followUpAt">تاریخ پیگیری</Label>
                <JalaliDateInput
                  id="lead-followUpAt"
                  value={form.followUpAt}
                  onChange={(v) => setForm((f) => ({ ...f, followUpAt: v }))}
                  className="bg-card"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-notes">یادداشت</Label>
                <textarea
                  id="lead-notes"
                  placeholder="یادداشت"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full min-h-[80px] rounded-xl border border-input bg-card px-3 py-2 text-sm resize-y"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              {drawer && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleDelete(drawer.id)}
                  disabled={saving}
                  aria-label="حذف"
                  title="حذف"
                  className="gap-2"
                >
                  <Trash2 className="size-4" />
                  حذف
                </Button>
              )}
              <Button type="button" variant="outline" onClick={closeForm}>
                انصراف
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving || (!form.firstName.trim() && !form.lastName.trim())}
              >
                {saving ? 'در حال ذخیره...' : 'ذخیره'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
