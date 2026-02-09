/**
 * صفحهٔ فعالیت — لیست تماس/جلسه/یادداشت، ایجاد.
 */
import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { formatFaNum } from '@/lib/numbers';
import { getUserDisplayName } from '@/lib/user-display';
import { PageBreadcrumb } from '@/components/PageBreadcrumb';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { JalaliDate } from '@/components/ui/jalali-date';
import { JalaliDateTimeInput } from '@/components/ui/jalali-date-input';

type ActivityItem = {
  id: string;
  type: string;
  body?: string | null;
  happenedAt: string;
  contact?: { id: string; firstName: string; lastName: string } | null;
  deal?: { id: string; title: string } | null;
  createdBy?: { id: string; phone: string | null; firstName: string | null; lastName: string | null } | null;
};

const TYPE_LABELS: Record<string, string> = {
  CALL: 'تماس',
  MEETING: 'جلسه',
  NOTE: 'یادداشت',
};

export default function Activity() {
  const [data, setData] = useState<{ data: ActivityItem[]; total: number; page: number; pageSize: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ type: 'NOTE', body: '', happenedAt: new Date().toISOString().slice(0, 16) });
  const [saving, setSaving] = useState(false);

  const pageSize = 50;

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    apiGet<{ data: ActivityItem[]; total: number; page: number; pageSize: number }>(`/activities?${params}`)
      .then((res) => setData({ ...res, page, pageSize: res.pageSize ?? pageSize }))
      .catch((e) => setError(e?.message ?? 'خطا'))
      .finally(() => setLoading(false));
  }, [page]);

  const refetch = () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    apiGet<{ data: ActivityItem[]; total: number }>(`/activities?${params}`).then((res) =>
      setData({ ...res, page, pageSize })
    );
  };

  const handleCreate = () => {
    setForm({ type: 'NOTE', body: '', happenedAt: new Date().toISOString().slice(0, 16) });
    setFormOpen(true);
  };

  const closeForm = () => setFormOpen(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPost('/activities', {
        type: form.type,
        body: form.body.trim() || undefined,
        happenedAt: new Date(form.happenedAt).toISOString(),
      });
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
      <PageBreadcrumb current="فعالیت" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-title-lg font-title">فعالیت</h1>
        <Button type="button" onClick={handleCreate}>
          ثبت فعالیت
        </Button>
      </div>

      {error && (
        <Alert className="rounded-card border-destructive/30 bg-destructive/10 text-destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="glass-table-surface overflow-x-auto rounded-card">
          <table className="w-full min-w-[400px]">
            <thead>
              <tr className="border-b border-[var(--border-default)] h-11 bg-[var(--bg-toolbar)]">
                <th className="text-start pe-4 ps-4 font-medium">نوع</th>
                <th className="text-start pe-4 ps-4 font-medium">محتوا</th>
                <th className="text-start pe-4 ps-4 font-medium">زمان</th>
                <th className="text-start pe-4 ps-4 font-medium">ثبت‌کننده</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b border-[var(--border-default)] h-12">
                  <td className="pe-4 ps-4"><Skeleton className="h-4 w-20" /></td>
                  <td className="pe-4 ps-4"><Skeleton className="h-4 w-48" /></td>
                  <td className="pe-4 ps-4"><Skeleton className="h-4 w-32" /></td>
                  <td className="pe-4 ps-4"><Skeleton className="h-4 w-24" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && data && (
        <>
          <div className="glass-table-surface overflow-x-auto rounded-card">
            <table className="w-full min-w-[400px]">
              <thead>
                <tr className="border-b border-[var(--border-default)] h-11 bg-[var(--bg-toolbar)]">
<th className="text-start pe-4 ps-4 font-medium">نوع</th>
                <th className="text-start pe-4 ps-4 font-medium">محتوا</th>
                <th className="text-start pe-4 ps-4 font-medium">زمان</th>
                <th className="text-start pe-4 ps-4 font-medium">ثبت‌کننده</th>
              </tr>
              </thead>
              <tbody>
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={4} className="pe-4 ps-4 py-8 text-center text-muted-foreground">
                      فعالیتی ثبت نشده است.
                    </td>
                  </tr>
                )}
                {data.data.map((a) => (
                  <tr key={a.id} className="border-b border-[var(--border-default)] h-12 hover:bg-[var(--bg-muted)]">
                    <td className="pe-4 ps-4">{TYPE_LABELS[a.type] ?? a.type}</td>
                    <td className="pe-4 ps-4">{a.body ?? '—'}</td>
                    <td className="pe-4 ps-4"><JalaliDate value={a.happenedAt} /></td>
                    <td className="pe-4 ps-4">{getUserDisplayName(a.createdBy)}</td>
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

      {formOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
          onClick={closeForm}
          onKeyDown={(e) => e.key === 'Escape' && closeForm()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="activity-form-title"
        >
          <div className="glass-card w-full max-w-md p-6 rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 id="activity-form-title" className="text-lg font-semibold mb-4">ثبت فعالیت</h2>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="activity-type">نوع</Label>
                <select
                  id="activity-type"
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-input bg-card px-3"
                >
                  <option value="CALL">تماس</option>
                  <option value="MEETING">جلسه</option>
                  <option value="NOTE">یادداشت</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="activity-body">محتوا / یادداشت</Label>
                <textarea
                  id="activity-body"
                  placeholder="توضیح کوتاه"
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  className="w-full min-h-[80px] rounded-xl border border-input bg-card px-3 py-2 text-sm"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="activity-happenedAt">زمان</Label>
                <JalaliDateTimeInput
                  id="activity-happenedAt"
                  value={form.happenedAt}
                  onChange={(v) => setForm((f) => ({ ...f, happenedAt: v }))}
                  className="bg-card"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <Button type="button" variant="outline" onClick={closeForm}>انصراف</Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? 'در حال ذخیره...' : 'ذخیره'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
