import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';

import { PageBreadcrumb } from '@/components/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { JalaliDate } from '@/components/ui/jalali-date';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import { digitsToFa, formatFaCurrency, formatFaNum } from '@/lib/numbers';

type Owner = { id: string; firstName?: string | null; lastName?: string | null; displayName?: string | null; email?: string | null; phone?: string | null };
type Company = { id: string; name: string };
type ViewTab = 'all' | 'mine' | 'team' | 'segments' | 'archive';

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  companyId?: string | null;
  ownerUserId?: string | null;
  owner?: Owner | null;
  company?: Company | null;
  customerType?: 'PERSON' | 'COMPANY';
  relationshipStatus?: 'ACTIVE' | 'DORMANT' | 'LOST';
  segment?: 'A' | 'B' | 'C';
  lastActivityType?: string | null;
  lastActivityAt?: string | null;
  openDealsCount?: number;
  openPipelineValue?: string;
  tags?: string[];
};

type ListResponse = { data: Contact[]; total: number; page: number; pageSize: number };
type SavedView = { id: string; name: string; tab: ViewTab; q: string; owner: string; status: string; segment: string; hasOpenDeals: string; activityDays: string };

const PAGE_SIZE = 25;
const SAVED_VIEWS_KEY = 'crm_contacts_saved_views_v1';
const TABS: Array<{ value: ViewTab; label: string }> = [
  { value: 'all', label: 'همه' },
  { value: 'mine', label: 'مشتریان من' },
  { value: 'team', label: 'تیم' },
  { value: 'segments', label: 'دسته‌بندی‌ها' },
  { value: 'archive', label: 'آرشیو' },
];

const ownerName = (o?: Owner | null) => (o ? o.displayName || `${o.firstName ?? ''} ${o.lastName ?? ''}`.trim() || o.email || o.phone || 'بدون مسئول' : 'بدون مسئول');
const statusLabel = (s?: string) => (s === 'ACTIVE' ? 'فعال' : s === 'DORMANT' ? 'غیرفعال' : s === 'LOST' ? 'آرشیوی' : 'نامشخص');
const statusClass = (s?: string) => (s === 'ACTIVE' ? 'border-emerald-200 bg-emerald-100 text-emerald-700' : s === 'DORMANT' ? 'border-amber-200 bg-amber-100 text-amber-700' : s === 'LOST' ? 'border-rose-200 bg-rose-100 text-rose-700' : 'border-slate-200 bg-slate-100 text-slate-700');
const tagText = (t: string) => ({ HAS_OPEN_DEAL: 'دارای معامله باز', NO_OPEN_DEAL: 'بدون معامله باز', HAS_COMPANY: 'دارای شرکت', NO_COMPANY: 'بدون شرکت', SEGMENT_A: 'Tier A', SEGMENT_B: 'Tier B', SEGMENT_C: 'Tier C', ACTIVE: 'فعال', DORMANT: 'غیرفعال', LOST: 'آرشیو' }[t] ?? t);

export default function Contacts() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { hasPermission, user } = useAuth();
  const canManageContacts = hasPermission('contacts.manage');
  const base = `/t/${tenantSlug}/app`;

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<ViewTab>('all');
  const [q, setQ] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [hasOpenDeals, setHasOpenDeals] = useState('');
  const [activityDays, setActivityDays] = useState('');

  const [owners, setOwners] = useState<Owner[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [selectedViewId, setSelectedViewId] = useState('');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOwnerId, setBulkOwnerId] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  const [editing, setEditing] = useState<Contact | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', companyId: '', ownerUserId: user?.id ?? '' });

  const allSelected = useMemo(() => {
    const ids = data?.data.map((x) => x.id) ?? [];
    return ids.length > 0 && ids.every((id) => selectedIds.includes(id));
  }, [data?.data, selectedIds]);

  useEffect(() => {
    const raw = localStorage.getItem(SAVED_VIEWS_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as SavedView[];
      if (Array.isArray(parsed)) setSavedViews(parsed);
    } catch {
      setSavedViews([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(savedViews));
  }, [savedViews]);

  useEffect(() => {
    apiGet<Owner[]>('/contacts/owners').then(setOwners).catch(() => setOwners([]));
  }, []);

  useEffect(() => {
    if (!formOpen) return;
    apiGet<{ data: Company[] }>('/companies?page=1&pageSize=200').then((res) => setCompanies(res.data)).catch(() => setCompanies([]));
  }, [formOpen]);

  async function fetchContacts() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (q.trim()) params.set('q', q.trim());
    const effectiveOwner = tab === 'mine' ? 'me' : !canManageContacts ? 'me' : ownerFilter;
    const effectiveStatus = tab === 'archive' ? 'LOST' : statusFilter;
    if (effectiveOwner && effectiveOwner !== 'all') params.set('owner', effectiveOwner);
    if (effectiveStatus) params.set('status', effectiveStatus);
    if (segmentFilter) params.set('segment', segmentFilter);
    if (hasOpenDeals) params.set('hasOpenDeals', hasOpenDeals);
    if (activityDays) params.set('activityDays', activityDays);
    try {
      setData(await apiGet<ListResponse>(`/contacts?${params.toString()}`));
      setSelectedIds([]);
    } catch (e: any) {
      setError(e?.message ?? 'خطا در دریافت مشتری‌ها');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchContacts();
  }, [page, tab, q, ownerFilter, statusFilter, segmentFilter, hasOpenDeals, activityDays, canManageContacts]);

  const openCreate = () => {
    setEditing(null);
    setForm({ firstName: '', lastName: '', phone: '', email: '', companyId: '', ownerUserId: owners[0]?.id ?? user?.id ?? '' });
    setFormOpen(true);
  };

  const openEdit = (c: Contact) => {
    setEditing(c);
    setForm({ firstName: c.firstName ?? '', lastName: c.lastName ?? '', phone: c.phone ?? '', email: c.email ?? '', companyId: c.companyId ?? '', ownerUserId: c.ownerUserId ?? owners[0]?.id ?? user?.id ?? '' });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const saveContact = async () => {
    if (!form.firstName.trim() && !form.lastName.trim()) return;
    setSaving(true);
    const payload = { firstName: form.firstName, lastName: form.lastName, phone: form.phone || null, email: form.email || null, companyId: form.companyId || null, ownerUserId: form.ownerUserId || null };
    try {
      if (editing) await apiPatch(`/contacts/${editing.id}`, payload);
      else await apiPost('/contacts', payload);
      closeForm();
      await fetchContacts();
    } catch (e: any) {
      setError(e?.message ?? 'خطا در ذخیره مشتری');
    } finally {
      setSaving(false);
    }
  };

  const removeContact = async (id: string) => {
    if (!window.confirm('مشتری حذف شود؟')) return;
    setSaving(true);
    try {
      await apiDelete(`/contacts/${id}`);
      closeForm();
      await fetchContacts();
    } catch (e: any) {
      setError(e?.message ?? 'خطا در حذف مشتری');
    } finally {
      setSaving(false);
    }
  };

  const runBulkAssign = async () => {
    if (!canManageContacts || selectedIds.length === 0) return;
    setBulkSaving(true);
    try {
      await apiPatch('/contacts/reassign', { ids: selectedIds, ownerUserId: bulkOwnerId || null });
      await fetchContacts();
    } catch (e: any) {
      setError(e?.message ?? 'خطا در انتساب گروهی');
    } finally {
      setBulkSaving(false);
    }
  };

  const saveCurrentView = () => {
    const name = window.prompt('نام ویو را وارد کنید');
    if (!name?.trim()) return;
    const view: SavedView = { id: `${Date.now()}`, name: name.trim(), tab, q, owner: ownerFilter, status: statusFilter, segment: segmentFilter, hasOpenDeals, activityDays };
    setSavedViews((prev) => [view, ...prev.filter((x) => x.name !== view.name)].slice(0, 12));
    setSelectedViewId(view.id);
  };

  const applyView = (id: string) => {
    setSelectedViewId(id);
    const view = savedViews.find((x) => x.id === id);
    if (!view) return;
    setTab(view.tab);
    setQ(view.q);
    setOwnerFilter(view.owner);
    setStatusFilter(view.status);
    setSegmentFilter(view.segment);
    setHasOpenDeals(view.hasOpenDeals);
    setActivityDays(view.activityDays);
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <PageBreadcrumb current="مشتریان" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-title-lg font-title">مشتریان</h1><p className="text-sm text-muted-foreground">فیلتر فروش، دسته‌بندی و مالک مشتری</p></div>
        <Button type="button" onClick={openCreate} className="gap-2"><Plus className="size-4" />مشتری جدید</Button>
      </div>
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-2">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setTab(t.value);
                setPage(1);
              }}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                tab === t.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-[var(--bg-muted)] text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-6">
          <Input type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="bg-white md:col-span-2" placeholder="جستجو..." />
          <select value={ownerFilter} onChange={(e) => { setOwnerFilter(e.target.value); setPage(1); }} disabled={!canManageContacts} className="h-10 rounded-xl border border-input bg-white px-3 text-sm disabled:opacity-60"><option value="all">همه مسئول‌ها</option><option value="me">مشتریان من</option>{owners.map((o) => <option key={o.id} value={o.id}>{ownerName(o)}</option>)}</select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="h-10 rounded-xl border border-input bg-white px-3 text-sm"><option value="">وضعیت</option><option value="ACTIVE">فعال</option><option value="DORMANT">غیرفعال</option><option value="LOST">آرشیوی</option></select>
          <select value={segmentFilter} onChange={(e) => { setSegmentFilter(e.target.value); setPage(1); }} className="h-10 rounded-xl border border-input bg-white px-3 text-sm"><option value="">دسته‌بندی</option><option value="A">Tier A</option><option value="B">Tier B</option><option value="C">Tier C</option></select>
          <select value={hasOpenDeals} onChange={(e) => { setHasOpenDeals(e.target.value); setPage(1); }} className="h-10 rounded-xl border border-input bg-white px-3 text-sm"><option value="">همه معاملات</option><option value="true">دارای معامله باز</option><option value="false">بدون معامله باز</option></select>
          <select value={activityDays} onChange={(e) => { setActivityDays(e.target.value); setPage(1); }} className="h-10 rounded-xl border border-input bg-white px-3 text-sm"><option value="">آخرین فعالیت</option><option value="7">۷ روز اخیر</option><option value="14">۱۴ روز اخیر</option><option value="30">۳۰ روز اخیر</option><option value="60">۶۰ روز اخیر</option></select>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <select value={selectedViewId} onChange={(e) => applyView(e.target.value)} className="h-9 rounded-lg border border-input bg-white px-3 text-xs"><option value="">ویوی ذخیره‌شده</option>{savedViews.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
          <Button type="button" variant="outline" size="sm" onClick={saveCurrentView}>ذخیره ویو</Button>
        </div>
      </div>
      {canManageContacts && selectedIds.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2"><span className="fa-num text-sm text-blue-700">{formatFaNum(selectedIds.length)} مورد</span><select value={bulkOwnerId} onChange={(e) => setBulkOwnerId(e.target.value)} className="h-9 rounded-lg border border-blue-200 bg-white px-3 text-xs"><option value="">بدون مسئول</option>{owners.map((o) => <option key={o.id} value={o.id}>{ownerName(o)}</option>)}</select><Button type="button" size="sm" onClick={runBulkAssign} disabled={bulkSaving}>{bulkSaving ? 'در حال انتساب...' : 'انتساب گروهی'}</Button></div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {loading ? <div className="glass-table-surface rounded-card p-4"><Skeleton className="h-6 w-full" /><Skeleton className="mt-3 h-6 w-full" /><Skeleton className="mt-3 h-6 w-full" /></div> : <div className="glass-table-surface overflow-x-auto rounded-card"><table className="w-full min-w-[1200px]"><thead><tr className="h-11 border-b border-[var(--border-default)] bg-[var(--bg-toolbar)]"><th className="w-10 px-3"><input type="checkbox" checked={allSelected} onChange={(e) => setSelectedIds(e.target.checked ? (data?.data ?? []).map((x) => x.id) : [])} /></th><th className="px-3 text-start">نام</th><th className="px-3 text-start">نوع</th><th className="px-3 text-start">مسئول</th><th className="px-3 text-start">وضعیت</th><th className="px-3 text-start">آخرین فعالیت</th><th className="px-3 text-start">باز</th><th className="px-3 text-start">ارزش</th><th className="px-3 text-start">دسته</th><th className="px-3 text-start">برچسب</th><th className="px-3 text-start">عملیات</th></tr></thead><tbody>{(data?.data ?? []).length === 0 && <tr><td colSpan={11} className="px-3 py-10 text-center text-muted-foreground">مشتری پیدا نشد</td></tr>}{(data?.data ?? []).map((c, i) => <tr key={c.id} className={`h-12 border-b border-[var(--border-default)] ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-indigo-50`}><td className="px-3"><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={(e) => setSelectedIds((prev) => e.target.checked ? Array.from(new Set([...prev, c.id])) : prev.filter((id) => id !== c.id))} /></td><td className="px-3"><Link to={`${base}/contacts/${c.id}`} className="font-medium text-primary hover:underline">{`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || 'بدون نام'}</Link><div className="text-xs text-slate-500">{c.phone ? digitsToFa(c.phone) : c.email || '-'}</div></td><td className="px-3"><span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-xs">{c.customerType === 'COMPANY' ? 'شرکتی' : 'شخصی'}</span></td><td className="px-3 text-sm">{ownerName(c.owner)}</td><td className="px-3"><span className={`rounded-full border px-2 py-1 text-xs ${statusClass(c.relationshipStatus)}`}>{statusLabel(c.relationshipStatus)}</span></td><td className="px-3"><div className="text-xs">{c.lastActivityType || 'بدون فعالیت'}</div><div className="text-[11px] text-slate-500">{c.lastActivityAt ? <JalaliDate value={c.lastActivityAt} dateOnly /> : '-'}</div></td><td className="fa-num px-3 text-sm">{formatFaNum(c.openDealsCount ?? 0)}</td><td className="px-3 text-sm">{Number(c.openPipelineValue ?? 0) > 0 ? formatFaCurrency(Number(c.openPipelineValue)) : '-'}</td><td className="px-3"><span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-xs">{c.segment ? `Tier ${c.segment}` : '-'}</span></td><td className="px-3">{(c.tags ?? []).slice(0, 2).map((t) => <span key={t} className="me-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px]">{tagText(t)}</span>)}</td><td className="px-3"><div className="flex items-center gap-1"><Link to={`${base}/contacts/${c.id}`} className="rounded-md p-2 text-muted-foreground hover:bg-[var(--bg-muted)] hover:text-foreground"><Eye className="size-4" /></Link><button type="button" className="rounded-md p-2 text-muted-foreground hover:bg-[var(--bg-muted)] hover:text-foreground" onClick={() => openEdit(c)}><Pencil className="size-4" /></button></div></td></tr>)}</tbody></table></div>}
      {!!data && data.total > PAGE_SIZE && <div className="mt-2 flex items-center justify-between"><span className="fa-num text-sm text-muted-foreground">{formatFaNum(data.data.length)} از {formatFaNum(data.total)}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>قبلی</Button><Button variant="outline" size="sm" disabled={page * PAGE_SIZE >= data.total} onClick={() => setPage((p) => p + 1)}>بعدی</Button></div></div>}
      {formOpen && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50" onClick={closeForm}><div className="glass-card w-full max-w-xl rounded-2xl p-6" onClick={(e) => e.stopPropagation()}><h2 className="mb-4 text-lg font-semibold">{editing ? 'ویرایش مشتری' : 'مشتری جدید'}</h2><div className="grid gap-3 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="f1">نام</Label><Input id="f1" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} className="bg-card" /></div><div className="space-y-2"><Label htmlFor="f2">نام خانوادگی</Label><Input id="f2" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} className="bg-card" /></div><div className="space-y-2"><Label htmlFor="f3">موبایل</Label><Input id="f3" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="bg-card" /></div><div className="space-y-2"><Label htmlFor="f4">ایمیل</Label><Input id="f4" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="bg-card" /></div><div className="space-y-2"><Label htmlFor="f5">شرکت</Label><select id="f5" value={form.companyId} onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))} className="h-10 w-full rounded-xl border border-input bg-card px-3"><option value="">بدون شرکت</option>{companies.map((co) => <option key={co.id} value={co.id}>{co.name}</option>)}</select></div><div className="space-y-2"><Label htmlFor="f6">فروشنده مسئول</Label><select id="f6" value={form.ownerUserId} onChange={(e) => setForm((f) => ({ ...f, ownerUserId: e.target.value }))} disabled={!canManageContacts} className="h-10 w-full rounded-xl border border-input bg-card px-3 disabled:opacity-60"><option value="">بدون مسئول</option>{owners.map((o) => <option key={o.id} value={o.id}>{ownerName(o)}</option>)}</select></div></div><div className="mt-5 flex justify-end gap-2">{editing && <Button type="button" variant="destructive" className="gap-2" onClick={() => void removeContact(editing.id)} disabled={saving}><Trash2 className="size-4" />حذف</Button>}<Button type="button" variant="outline" onClick={closeForm}>انصراف</Button><Button type="button" onClick={() => void saveContact()} disabled={saving || (!form.firstName.trim() && !form.lastName.trim())}>{saving ? 'در حال ذخیره...' : 'ذخیره'}</Button></div></div></div>}
    </div>
  );
}

