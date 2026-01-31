/**
 * صفحهٔ کارها — لیست، جستجو، صفحه‌بندی، ایجاد/ویرایش/حذف.
 */
import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { formatFaNum } from '@/lib/numbers';
import { PageBreadcrumb } from '@/components/PageBreadcrumb';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { JalaliDate } from '@/components/ui/jalali-date';

type Task = {
  id: string;
  title: string;
  dueAt?: string | null;
  status: string;
  contact?: { id: string; fullName: string } | null;
  deal?: { id: string; title: string } | null;
};

export default function Tasks() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/t/${tenantSlug}/app`;
  const [data, setData] = useState<{ data: Task[]; total: number; page: number; pageSize: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [drawer, setDrawer] = useState<Task | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ title: '', dueAt: '', status: 'OPEN' });
  const [saving, setSaving] = useState(false);

  const pageSize = 25;

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (q.trim()) params.set('q', q.trim());
    if (statusFilter) params.set('status', statusFilter);
    apiGet<{ data: Task[]; total: number; page: number; pageSize: number }>(`/tasks?${params}`)
      .then((res) => setData({ ...res, page, pageSize: res.pageSize ?? pageSize }))
      .catch((e) => setError(e?.message ?? 'خطا'))
      .finally(() => setLoading(false));
  }, [page, q, statusFilter]);

  const refetch = () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (q.trim()) params.set('q', q.trim());
    if (statusFilter) params.set('status', statusFilter);
    apiGet<{ data: Task[]; total: number }>(`/tasks?${params}`).then((res) =>
      setData({ ...res, page, pageSize })
    );
  };

  const handleCreate = () => {
    setDrawer(null);
    setForm({ title: '', dueAt: '', status: 'OPEN' });
    setFormOpen(true);
  };

  const closeForm = () => {
    setDrawer(null);
    setFormOpen(false);
    setForm({ title: '', dueAt: '', status: 'OPEN' });
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (drawer) {
        await apiPatch(`/tasks/${drawer.id}`, {
          title: form.title,
          dueAt: form.dueAt || undefined,
          status: form.status,
        });
        closeForm();
      } else {
        await apiPost('/tasks', { title: form.title, dueAt: form.dueAt || undefined, status: form.status });
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
    if (!confirm('حذف این کار؟')) return;
    setSaving(true);
    try {
      await apiDelete(`/tasks/${id}`);
      closeForm();
      refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-title-lg font-title">کارها</h1>
        <div className="flex gap-2">
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
            <option value="">همه</option>
            <option value="OPEN">باز</option>
            <option value="DONE">انجام‌شده</option>
          </select>
          <Button type="button" onClick={handleCreate}>
            کار جدید
          </Button>
        </div>
      </div>

      {error && (
        <Alert className="rounded-card border-destructive/30 bg-destructive/10 text-destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="glass-table-surface overflow-hidden rounded-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-default)] h-11 bg-[var(--bg-toolbar)]">
                <th className="text-start pe-4 ps-4 font-medium">عنوان</th>
                <th className="text-start pe-4 ps-4 font-medium">موعد</th>
                <th className="text-start pe-4 ps-4 font-medium">وضعیت</th>
                <th className="text-start pe-4 ps-4 w-20">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b border-[var(--border-default)] h-12">
                  <td className="pe-4 ps-4"><Skeleton className="h-4 w-40" /></td>
                  <td className="pe-4 ps-4"><Skeleton className="h-4 w-24" /></td>
                  <td className="pe-4 ps-4"><Skeleton className="h-4 w-16" /></td>
                  <td className="pe-4 ps-4"><Skeleton className="h-8 w-16" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && data && (
        <>
          <div className="glass-table-surface overflow-hidden rounded-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-default)] h-11 bg-[var(--bg-toolbar)]">
                  <th className="text-start pe-4 ps-4 font-medium">عنوان</th>
                  <th className="text-start pe-4 ps-4 font-medium">موعد</th>
                  <th className="text-start pe-4 ps-4 font-medium">وضعیت</th>
                  <th className="text-start pe-4 ps-4 w-20">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={4} className="pe-4 ps-4 py-8 text-center text-muted-foreground">
                      کاری یافت نشد.
                    </td>
                  </tr>
                )}
                {data.data.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--border-default)] h-12 hover:bg-[var(--bg-muted)]">
                    <td className="pe-4 ps-4">
                      <Link to={`${base}/tasks/${t.id}`} className="font-medium text-primary hover:underline">
                        {t.title}
                      </Link>
                    </td>
                    <td className="pe-4 ps-4"><JalaliDate value={t.dueAt} dateOnly /></td>
                    <td className="pe-4 ps-4">{t.status === 'DONE' ? 'انجام‌شده' : 'باز'}</td>
                    <td className="pe-4 ps-4">
                      <Link to={`${base}/tasks/${t.id}`} className="text-sm text-muted-foreground hover:text-foreground ml-2">
                        مشاهده
                      </Link>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => {
                          setDrawer(t);
                          setFormOpen(true);
                          setForm({
                            title: t.title,
                            dueAt: t.dueAt ? t.dueAt.slice(0, 10) : '',
                            status: t.status,
                          });
                        }}
                      >
                        ویرایش
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.total > pageSize && (
            <div className="mt-4 flex justify-between items-center">
              <span className="text-sm text-muted-foreground fa-num">{formatFaNum(data.data.length)} از {formatFaNum(data.total)}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>قبلی</Button>
                <Button variant="outline" size="sm" disabled={page * pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>بعدی</Button>
              </div>
            </div>
          )}
        </>
      )}

      {(drawer || formOpen) && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
          onClick={closeForm}
          onKeyDown={(e) => e.key === 'Escape' && closeForm()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-form-title"
        >
          <div className="glass-card w-full max-w-md p-6 rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 id="task-form-title" className="text-lg font-semibold mb-4">{drawer ? 'ویرایش کار' : 'کار جدید'}</h2>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="task-title">عنوان</Label>
                <Input
                  id="task-title"
                  type="text"
                  placeholder="عنوان"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="bg-card"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-dueAt">موعد</Label>
                <Input
                  id="task-dueAt"
                  type="date"
                  placeholder="موعد"
                  value={form.dueAt}
                  onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
                  className="bg-card"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-status">وضعیت</Label>
                <select
                  id="task-status"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-input bg-card px-3"
                >
                  <option value="OPEN">باز</option>
                  <option value="DONE">انجام‌شده</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              {drawer && (
                <Button type="button" variant="destructive" onClick={() => handleDelete(drawer.id)} disabled={saving}>حذف</Button>
              )}
              <Button type="button" variant="outline" onClick={closeForm}>انصراف</Button>
              <Button type="button" onClick={handleSave} disabled={saving || !form.title.trim()}>
                {saving ? 'در حال ذخیره...' : 'ذخیره'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
