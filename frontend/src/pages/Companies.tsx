import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Eye, Globe, LayoutGrid, List, Pencil, Phone, Plus, Trash2, User } from 'lucide-react';

import { PageBreadcrumb } from '@/components/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { JalaliDate } from '@/components/ui/jalali-date';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import { digitsToFa, formatFaCurrency, formatFaNum } from '@/lib/numbers';

type AccountStatus = 'HOT' | 'WARM' | 'COLD';
type Segment = 'A' | 'B' | 'C';
type ViewMode = 'cards' | 'list';

type Owner = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
};

type Company = {
  id: string;
  name: string;
  phone?: string | null;
  website?: string | null;
  ownerUserId?: string | null;
  owner?: Owner | null;
  salesStatus?: AccountStatus;
  segment?: Segment;
  contactsCount?: number;
  openDealsCount?: number;
  overdueTasksCount?: number;
  lastActivityType?: string | null;
  lastActivityAt?: string | null;
  openPipelineValue?: string;
  tags?: string[];
};

type ListResponse = {
  data: Company[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 24;

const QUICK_SEGMENTS = [
  { id: 'all', label: 'همه', apply: () => ({ status: '', segment: '', hasOpenDeals: '', activityDays: '', owner: 'all' }) },
  { id: 'active', label: 'فعال‌ها', apply: () => ({ status: 'HOT', segment: '', hasOpenDeals: '', activityDays: '14', owner: 'all' }) },
  { id: 'stale', label: 'بدون پیگیری ۳۰+', apply: () => ({ status: 'COLD', segment: '', hasOpenDeals: '', activityDays: '', owner: 'all' }) },
  { id: 'open', label: 'دارای معامله باز', apply: () => ({ status: '', segment: '', hasOpenDeals: 'true', activityDays: '', owner: 'all' }) },
  { id: 'tierA', label: 'VIP / Tier A', apply: () => ({ status: '', segment: 'A', hasOpenDeals: '', activityDays: '', owner: 'all' }) },
  { id: 'mine', label: 'حساب‌های من', apply: () => ({ status: '', segment: '', hasOpenDeals: '', activityDays: '', owner: 'me' }) },
] as const;

function ownerName(owner?: Owner | null): string {
  if (!owner) return 'بدون مسئول';
  const full = `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim();
  return owner.displayName?.trim() || full || owner.email || owner.phone || 'بدون مسئول';
}

function ownerInitial(owner?: Owner | null): string {
  return ownerName(owner).charAt(0) || '?';
}

function statusLabel(status?: string): string {
  if (status === 'HOT') return 'Hot';
  if (status === 'WARM') return 'Warm';
  if (status === 'COLD') return 'Cold';
  return 'نامشخص';
}

function statusPillClass(status?: string): string {
  if (status === 'HOT') return 'border-rose-200 bg-rose-100 text-rose-700';
  if (status === 'WARM') return 'border-amber-200 bg-amber-100 text-amber-700';
  if (status === 'COLD') return 'border-sky-200 bg-sky-100 text-sky-700';
  return 'border-slate-200 bg-slate-100 text-slate-700';
}

function cardSurfaceClass(status?: string): string {
  if (status === 'HOT') return 'border-rose-200 bg-rose-50/80';
  if (status === 'WARM') return 'border-amber-200 bg-amber-50/80';
  if (status === 'COLD') return 'border-sky-200 bg-sky-50/80';
  return 'border-slate-200 bg-slate-50/90';
}

function segmentClass(segment?: string): string {
  if (segment === 'A') return 'border-indigo-200 bg-indigo-100 text-indigo-700';
  if (segment === 'B') return 'border-sky-200 bg-sky-100 text-sky-700';
  if (segment === 'C') return 'border-slate-200 bg-slate-100 text-slate-700';
  return 'border-slate-200 bg-slate-100 text-slate-700';
}

function activityTypeLabel(type?: string | null): string {
  if (!type) return 'بدون فعالیت';
  if (type === 'CALL') return 'تماس';
  if (type === 'MEETING') return 'جلسه';
  if (type === 'NOTE') return 'یادداشت';
  return type;
}

function tagText(tag: string): string {
  if (tag === 'HAS_OPEN_DEAL') return 'دارای معامله باز';
  if (tag === 'NO_OPEN_DEAL') return 'بدون معامله باز';
  if (tag === 'HAS_OVERDUE_TASK') return 'دارای تسک عقب‌افتاده';
  if (tag === 'NO_OVERDUE_TASK') return 'تسک‌ها سالم';
  if (tag === 'SEGMENT_A') return 'Tier A';
  if (tag === 'SEGMENT_B') return 'Tier B';
  if (tag === 'SEGMENT_C') return 'Tier C';
  if (tag === 'HOT') return 'Hot';
  if (tag === 'WARM') return 'Warm';
  if (tag === 'COLD') return 'Cold';
  return tag;
}

function formatCurrency(value?: string): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return '-';
  return formatFaCurrency(n);
}

function getHost(website?: string | null): string | null {
  if (!website) return null;
  const raw = website.startsWith('http') ? website : `https://${website}`;
  try {
    return new URL(raw).host;
  } catch {
    return website;
  }
}

export default function Companies() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { hasPermission } = useAuth();
  const canManageCompanies = hasPermission('companies.manage');
  const base = `/t/${tenantSlug}/app`;

  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [quickSegment, setQuickSegment] = useState<string>('all');

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [hasOpenDealsFilter, setHasOpenDealsFilter] = useState('');
  const [activityDaysFilter, setActivityDaysFilter] = useState('');

  const [owners, setOwners] = useState<Owner[]>([]);

  const [drawer, setDrawer] = useState<Company | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', website: '' });
  const [saving, setSaving] = useState(false);

  const effectiveOwner = !canManageCompanies ? 'me' : ownerFilter;

  useEffect(() => {
    apiGet<Owner[]>('/companies/owners').then(setOwners).catch(() => setOwners([]));
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (q.trim()) params.set('q', q.trim());
    if (effectiveOwner && effectiveOwner !== 'all') params.set('owner', effectiveOwner);
    if (statusFilter) params.set('status', statusFilter);
    if (segmentFilter) params.set('segment', segmentFilter);
    if (hasOpenDealsFilter) params.set('hasOpenDeals', hasOpenDealsFilter);
    if (activityDaysFilter) params.set('activityDays', activityDaysFilter);

    try {
      setData(await apiGet<ListResponse>(`/companies?${params.toString()}`));
    } catch (e: any) {
      setError(e?.message ?? 'خطا در دریافت حساب‌های مشتری');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCompanies();
  }, [page, q, effectiveOwner, statusFilter, segmentFilter, hasOpenDealsFilter, activityDaysFilter]);

  const openCreate = () => {
    setDrawer(null);
    setForm({ name: '', phone: '', website: '' });
    setFormOpen(true);
  };

  const openEdit = (company: Company) => {
    setDrawer(company);
    setForm({ name: company.name, phone: company.phone ?? '', website: company.website ?? '' });
    setFormOpen(true);
  };

  const closeForm = () => {
    setDrawer(null);
    setFormOpen(false);
    setForm({ name: '', phone: '', website: '' });
  };

  const saveCompany = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (drawer) {
        await apiPatch(`/companies/${drawer.id}`, form);
      } else {
        await apiPost('/companies', form);
      }
      closeForm();
      await fetchCompanies();
    } catch (e: any) {
      setError(e?.message ?? 'خطا در ذخیره حساب');
    } finally {
      setSaving(false);
    }
  };

  const removeCompany = async (id: string) => {
    if (!window.confirm('حذف این حساب مشتری انجام شود؟')) return;
    setSaving(true);
    try {
      await apiDelete(`/companies/${id}`);
      closeForm();
      await fetchCompanies();
    } catch (e: any) {
      setError(e?.message ?? 'خطا در حذف حساب');
    } finally {
      setSaving(false);
    }
  };

  const applyQuickSegment = (segmentId: string) => {
    setQuickSegment(segmentId);
    const picked = QUICK_SEGMENTS.find((item) => item.id === segmentId);
    if (!picked) return;
    const next = picked.apply();
    setStatusFilter(next.status);
    setSegmentFilter(next.segment);
    setHasOpenDealsFilter(next.hasOpenDeals);
    setActivityDaysFilter(next.activityDays);
    setOwnerFilter(next.owner);
    setPage(1);
  };

  const totals = useMemo(() => {
    const list = data?.data ?? [];
    return {
      openDeals: list.reduce((sum, company) => sum + (company.openDealsCount ?? 0), 0),
      overdueTasks: list.reduce((sum, company) => sum + (company.overdueTasksCount ?? 0), 0),
    };
  }, [data?.data]);

  return (
    <div className="space-y-5">
      <PageBreadcrumb current="حساب‌های مشتری" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title-lg font-title">حساب‌های مشتری (شرکت‌ها)</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            نمای حساب‌محور برای تصمیم سریع مدیر فروش
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-2">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                viewMode === 'cards'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-[var(--bg-muted)] text-muted-foreground hover:text-foreground'
              }`}
              title="نمای کارت"
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-[var(--bg-muted)] text-muted-foreground hover:text-foreground'
              }`}
              title="نمای لیست"
            >
              <List className="size-4" />
            </button>
          </div>
          <Button type="button" onClick={openCreate} className="gap-2">
            <Plus className="size-4" />
            شرکت جدید
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_SEGMENTS.map((segment) => (
          <button
            key={segment.id}
            type="button"
            onClick={() => applyQuickSegment(segment.id)}
            className={`rounded-xl border px-3 py-2 text-sm transition ${
              quickSegment === segment.id
                ? 'border-blue-200 bg-blue-100 text-blue-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            {segment.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-6">
          <Input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="جستجو نام/دامنه/تلفن..."
            className="bg-white md:col-span-2"
          />
          <select
            value={ownerFilter}
            onChange={(e) => {
              setOwnerFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-input bg-white px-3 text-sm disabled:opacity-60"
            disabled={!canManageCompanies}
          >
            <option value="all">همه Ownerها</option>
            <option value="me">حساب‌های من</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {ownerName(owner)}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-input bg-white px-3 text-sm"
          >
            <option value="">وضعیت فروش</option>
            <option value="HOT">Hot</option>
            <option value="WARM">Warm</option>
            <option value="COLD">Cold</option>
          </select>
          <select
            value={hasOpenDealsFilter}
            onChange={(e) => {
              setHasOpenDealsFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-input bg-white px-3 text-sm"
          >
            <option value="">معاملات</option>
            <option value="true">دارای معامله باز</option>
            <option value="false">بدون معامله باز</option>
          </select>
          <select
            value={activityDaysFilter}
            onChange={(e) => {
              setActivityDaysFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-input bg-white px-3 text-sm"
          >
            <option value="">آخرین فعالیت</option>
            <option value="7">۷ روز اخیر</option>
            <option value="14">۱۴ روز اخیر</option>
            <option value="30">۳۰ روز اخیر</option>
            <option value="60">۶۰ روز اخیر</option>
          </select>
          <select
            value={segmentFilter}
            onChange={(e) => {
              setSegmentFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-input bg-white px-3 text-sm"
          >
            <option value="">Tier</option>
            <option value="A">Tier A</option>
            <option value="B">Tier B</option>
            <option value="C">Tier C</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="text-xs text-slate-500">حساب‌های این صفحه</div>
          <div className="fa-num mt-1 text-lg font-semibold">{formatFaNum(data?.data.length ?? 0)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="text-xs text-slate-500">مجموع معاملات باز</div>
          <div className="fa-num mt-1 text-lg font-semibold">{formatFaNum(totals.openDeals)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="text-xs text-slate-500">تسک‌های overdue</div>
          <div className="fa-num mt-1 text-lg font-semibold">{formatFaNum(totals.overdueTasks)}</div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-3 h-4 w-32" />
              <Skeleton className="mt-3 h-12 w-full" />
            </div>
          ))}
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(data?.data ?? []).map((company) => {
            const host = getHost(company.website);
            return (
              <article
                key={company.id}
                className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${cardSurfaceClass(company.salesStatus)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link to={`${base}/companies/${company.id}`} className="block truncate text-base font-semibold text-slate-900 hover:underline">
                      {company.name}
                    </Link>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                      <span className={`rounded-full border px-2 py-0.5 ${statusPillClass(company.salesStatus)}`}>
                        {statusLabel(company.salesStatus)}
                      </span>
                      {company.segment && (
                        <span className={`rounded-full border px-2 py-0.5 ${segmentClass(company.segment)}`}>
                          Tier {company.segment}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-slate-500 hover:bg-white/80 hover:text-slate-900"
                    onClick={() => openEdit(company)}
                    title="ویرایش"
                  >
                    <Pencil className="size-4" />
                  </button>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <User className="size-3.5" />
                    <span>{ownerName(company.owner)}</span>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
                      {ownerInitial(company.owner)}
                    </span>
                  </div>
                  {host && (
                    <a
                      href={company.website?.startsWith('http') ? company.website : `https://${company.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 hover:underline"
                    >
                      <Globe className="size-3.5" />
                      {host}
                    </a>
                  )}
                  {company.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="size-3.5" />
                      <span className="fa-num">{digitsToFa(company.phone)}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1.5">
                    <div className="text-[11px] text-slate-500">Contacts</div>
                    <div className="fa-num text-sm font-semibold">{formatFaNum(company.contactsCount ?? 0)}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1.5">
                    <div className="text-[11px] text-slate-500">Deals open</div>
                    <div className="fa-num text-sm font-semibold">{formatFaNum(company.openDealsCount ?? 0)}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1.5">
                    <div className="text-[11px] text-slate-500">Tasks overdue</div>
                    <div className="fa-num text-sm font-semibold">{formatFaNum(company.overdueTasksCount ?? 0)}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1.5">
                    <div className="text-[11px] text-slate-500">Pipeline value</div>
                    <div className="text-sm font-semibold">{formatCurrency(company.openPipelineValue)}</div>
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-slate-600">
                  <span className="font-medium">{activityTypeLabel(company.lastActivityType)}</span>
                  <span className="mx-1 text-slate-400">•</span>
                  {company.lastActivityAt ? <JalaliDate value={company.lastActivityAt} dateOnly /> : 'بدون فعالیت'}
                </div>

                <div className="mt-2 flex flex-wrap gap-1">
                  {(company.tags ?? []).slice(0, 3).map((tag) => (
                    <span
                      key={`${company.id}-${tag}`}
                      className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600"
                    >
                      {tagText(tag)}
                    </span>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link to={`${base}/companies/${company.id}`} className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100">
                    مشاهده
                  </Link>
                  <Link to={`${base}/quotes?companyId=${company.id}`} className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100">
                    ایجاد معامله
                  </Link>
                  <Link to={`${base}/tasks?companyId=${company.id}`} className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100">
                    ایجاد تسک
                  </Link>
                  <Link to={`${base}/contacts?companyId=${company.id}`} className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100">
                    افزودن مخاطب
                  </Link>
                </div>
              </article>
            );
          })}
          {(data?.data ?? []).length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center text-sm text-slate-500">
              حسابی مطابق فیلترها پیدا نشد.
            </div>
          )}
        </div>
      ) : (
        <div className="glass-table-surface overflow-x-auto rounded-card">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="h-11 border-b border-[var(--border-default)] bg-[var(--bg-toolbar)]">
                <th className="px-3 text-start font-medium">نام</th>
                <th className="px-3 text-start font-medium">Owner</th>
                <th className="px-3 text-start font-medium">وضعیت</th>
                <th className="px-3 text-start font-medium">Deals باز</th>
                <th className="px-3 text-start font-medium">Overdue</th>
                <th className="px-3 text-start font-medium">آخرین فعالیت</th>
                <th className="px-3 text-start font-medium">ارزش باز</th>
                <th className="px-3 text-start font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {(data?.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                    حسابی مطابق فیلترها پیدا نشد.
                  </td>
                </tr>
              )}
              {(data?.data ?? []).map((company, idx) => (
                <tr
                  key={company.id}
                  className={`h-12 border-b border-[var(--border-default)] ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-indigo-50`}
                >
                  <td className="px-3">
                    <Link to={`${base}/companies/${company.id}`} className="font-medium text-primary hover:underline">
                      {company.name}
                    </Link>
                  </td>
                  <td className="px-3">{ownerName(company.owner)}</td>
                  <td className="px-3">
                    <span className={`rounded-full border px-2 py-1 text-xs ${statusPillClass(company.salesStatus)}`}>
                      {statusLabel(company.salesStatus)}
                    </span>
                  </td>
                  <td className="fa-num px-3">{formatFaNum(company.openDealsCount ?? 0)}</td>
                  <td className="fa-num px-3">{formatFaNum(company.overdueTasksCount ?? 0)}</td>
                  <td className="px-3 text-xs">{company.lastActivityAt ? <JalaliDate value={company.lastActivityAt} dateOnly /> : '-'}</td>
                  <td className="px-3 text-sm">{formatCurrency(company.openPipelineValue)}</td>
                  <td className="px-3">
                    <div className="flex items-center gap-1">
                      <Link
                        to={`${base}/companies/${company.id}`}
                        className="rounded-md p-2 text-muted-foreground hover:bg-[var(--bg-muted)] hover:text-foreground"
                        aria-label="مشاهده"
                        title="مشاهده"
                      >
                        <Eye className="size-4" />
                      </Link>
                      <button
                        type="button"
                        className="rounded-md p-2 text-muted-foreground hover:bg-[var(--bg-muted)] hover:text-foreground"
                        onClick={() => openEdit(company)}
                        aria-label="ویرایش"
                        title="ویرایش"
                      >
                        <Pencil className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!!data && data.total > PAGE_SIZE && (
        <div className="mt-2 flex items-center justify-between">
          <span className="fa-num text-sm text-muted-foreground">
            {formatFaNum(data.data.length)} از {formatFaNum(data.total)}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)}>
              قبلی
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page * PAGE_SIZE >= data.total}
              onClick={() => setPage((prev) => prev + 1)}
            >
              بعدی
            </Button>
          </div>
        </div>
      )}

      {(drawer || formOpen) && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
          onClick={closeForm}
          onKeyDown={(e) => e.key === 'Escape' && closeForm()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="company-form-title"
        >
          <div className="glass-card w-full max-w-md rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 id="company-form-title" className="mb-4 text-lg font-semibold">
              {drawer ? 'ویرایش حساب مشتری' : 'حساب مشتری جدید'}
            </h2>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="company-name">نام شرکت</Label>
                <Input
                  id="company-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="bg-card"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-phone">تلفن</Label>
                <Input
                  id="company-phone"
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="bg-card"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-website">وب‌سایت</Label>
                <Input
                  id="company-website"
                  type="url"
                  value={form.website}
                  onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))}
                  className="bg-card"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              {drawer && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void removeCompany(drawer.id)}
                  disabled={saving}
                  className="gap-2"
                >
                  <Trash2 className="size-4" />
                  حذف
                </Button>
              )}
              <Button type="button" variant="outline" onClick={closeForm}>
                انصراف
              </Button>
              <Button type="button" onClick={() => void saveCompany()} disabled={saving || !form.name.trim()}>
                {saving ? 'در حال ذخیره...' : 'ذخیره'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


