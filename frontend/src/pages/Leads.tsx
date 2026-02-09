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
import { getUserDisplayName } from '@/lib/user-display';
import { Pencil, Trash2 } from 'lucide-react';

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
  ownerUserId?: string | null;
  owner?: { id: string; phone: string | null; firstName: string | null; lastName: string | null } | null;
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

export default function Leads() {
  const [data, setData] = useState<{
    data: Lead[];
    total: number;
    page: number;
    pageSize: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [drawer, setDrawer] = useState<Lead | null>(null);
  const [formOpen, setFormOpen] = useState(false);
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

  const pageSize = 50;

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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = (s: string) => STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;

  return (
    <div className="space-y-5">
      <PageBreadcrumb current="لیدها" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-title-lg font-title">لیدها</h1>
        <div className="flex gap-2 flex-wrap">
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
        </div>
      </div>

      {error && (
        <Alert className="rounded-card border-destructive/30 bg-destructive/10 text-destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
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

      {!loading && data && (
        <>
          <div className="glass-table-surface overflow-x-auto rounded-card">
            <table className="w-full min-w-[780px]">
              <thead>
                <tr className="border-b border-[var(--border-default)] h-11 bg-[var(--bg-toolbar)]">
                  <th className="text-start pe-4 ps-4 font-medium">نام</th>
                  <th className="text-start pe-4 ps-4 font-medium">نام خانوادگی</th>
                  <th className="text-start pe-4 ps-4 font-medium">تلفن / ایمیل</th>
                  <th className="text-start pe-4 ps-4 font-medium">شرکت</th>
                  <th className="text-start pe-4 ps-4 font-medium">منبع</th>
                  <th className="text-start pe-4 ps-4 font-medium">وضعیت</th>
                  <th className="text-start pe-4 ps-4 font-medium">مسئول</th>
                  <th className="text-start pe-4 ps-4 font-medium">تاریخ پیگیری</th>
                  <th className="text-start pe-4 ps-4 w-24">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={9} className="pe-4 ps-4 py-8 text-center text-muted-foreground">
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
                    <td className="pe-4 ps-4 text-sm">{getUserDisplayName(lead.owner)}</td>
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
