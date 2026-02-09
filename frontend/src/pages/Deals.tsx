/**
 * صفحهٔ معاملات — لیست، جستجو، صفحه‌بندی، ایجاد/ویرایش/حذف.
 */
import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { formatFaNum } from '@/lib/numbers';
import { getUserDisplayName } from '@/lib/user-display';
import { PageBreadcrumb } from '@/components/PageBreadcrumb';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, Pencil, Trash2 } from 'lucide-react';

type PipelineStage = { id: string; name: string; order: number };
type Pipeline = { id: string; name: string; isDefault?: boolean; stages: PipelineStage[] };
type StageWithPipeline = PipelineStage & { pipelineId: string };

type Deal = {
  id: string;
  title: string;
  amount?: unknown;
  stage?: { id: string; name: string };
  pipeline?: { id: string; name: string };
  contact?: { id: string; firstName: string; lastName: string } | null;
  company?: { id: string; name: string } | null;
  owner?: { id: string; phone: string | null; firstName: string | null; lastName: string | null } | null;
};

export default function Deals() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/t/${tenantSlug}/app`;
  const [data, setData] = useState<{ data: Deal[]; total: number; page: number; pageSize: number } | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [drawer, setDrawer] = useState<Deal | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ title: '', amount: '', stageId: '', pipelineId: '' });
  const [saving, setSaving] = useState(false);

  const pageSize = 50;

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (q.trim()) params.set('q', q.trim());
    Promise.all([
      apiGet<{ data: Deal[]; total: number; page: number; pageSize: number }>(`/deals?${params}`),
      apiGet<Pipeline[]>('/pipelines'),
    ])
      .then(([dealsRes, pipes]) => {
        setData({ ...dealsRes, page, pageSize: dealsRes.pageSize ?? pageSize });
        setPipelines(pipes ?? []);
      })
      .catch((e) => setError(e?.message ?? 'خطا'))
      .finally(() => setLoading(false));
  }, [page, q]);

  const refetch = () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (q.trim()) params.set('q', q.trim());
    apiGet<{ data: Deal[]; total: number }>(`/deals?${params}`).then((res) =>
      setData({ ...res, page, pageSize })
    );
  };

  const stages: StageWithPipeline[] = pipelines.flatMap((p) =>
    p.stages.map((s) => ({ ...s, pipelineId: p.id }))
  );
  const defaultPipeline = pipelines.find((p) => p.isDefault) ?? pipelines[0];
  const defaultStage = defaultPipeline?.stages?.[0];

  const handleCreate = () => {
    setDrawer(null);
    setForm({
      title: '',
      amount: '',
      stageId: defaultStage?.id ?? '',
      pipelineId: defaultPipeline?.id ?? '',
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setDrawer(null);
    setFormOpen(false);
    setForm({ title: '', amount: '', stageId: '', pipelineId: '' });
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.stageId || !form.pipelineId) return;
    setSaving(true);
    try {
      if (drawer) {
        await apiPatch(`/deals/${drawer.id}`, {
          title: form.title,
          amount: form.amount ? Number(form.amount) : undefined,
          stageId: form.stageId,
          pipelineId: form.pipelineId,
        });
        closeForm();
      } else {
        await apiPost('/deals', {
          title: form.title,
          amount: form.amount ? Number(form.amount) : undefined,
          stageId: form.stageId,
          pipelineId: form.pipelineId,
        });
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
    if (!confirm('حذف این معامله؟')) return;
    setSaving(true);
    try {
      await apiDelete(`/deals/${id}`);
      closeForm();
      refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setSaving(false);
    }
  };

  const formatAmount = (v: unknown) => formatFaNum(v == null ? null : Number(v));

  return (
    <div className="space-y-5">
      <PageBreadcrumb current="معاملات" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-title-lg font-title">معاملات</h1>
        <div className="flex gap-2">
          <Input
            type="search"
            placeholder="جستجو..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-48 bg-card"
          />
          <Button type="button" onClick={handleCreate} disabled={pipelines.length === 0} className="whitespace-nowrap">
            معامله جدید
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
                <th className="text-start pe-4 ps-4 font-medium">مبلغ</th>
                <th className="text-start pe-4 ps-4 font-medium">مسئول</th>
                <th className="text-start pe-4 ps-4 w-20">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b border-[var(--border-default)] h-12">
                  <td className="pe-4 ps-4"><Skeleton className="h-4 w-36" /></td>
                  <td className="pe-4 ps-4"><Skeleton className="h-4 w-24" /></td>
                  <td className="pe-4 ps-4"><Skeleton className="h-4 w-20" /></td>
                  <td className="pe-4 ps-4"><Skeleton className="h-4 w-24" /></td>
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
                <th className="text-start pe-4 ps-4 font-medium">مبلغ</th>
                <th className="text-start pe-4 ps-4 font-medium">مسئول</th>
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
                      <Link to={`${base}/deals/${d.id}`} className="font-medium text-primary hover:underline">
                        {d.title}
                      </Link>
                    </td>
                    <td className="pe-4 ps-4">{d.stage?.name ?? '—'}</td>
                    <td className="pe-4 ps-4 fa-num">{formatAmount(d.amount)}</td>
                    <td className="pe-4 ps-4">{getUserDisplayName(d.owner)}</td>
                    <td className="pe-4 ps-4 flex items-center gap-1">
                      <Link to={`${base}/deals/${d.id}`} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-[var(--bg-muted)]" aria-label="مشاهده" title="مشاهده">
                        <Eye className="size-4" />
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setDrawer(d);
                          setFormOpen(true);
                          setForm({
                            title: d.title,
                            amount: d.amount != null ? String(d.amount) : '',
                            stageId: d.stage?.id ?? '',
                            pipelineId: d.pipeline?.id ?? '',
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

      {(drawer || formOpen) && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
          onClick={closeForm}
          onKeyDown={(e) => e.key === 'Escape' && closeForm()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="deal-form-title"
        >
          <div className="glass-card w-full max-w-md p-6 rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 id="deal-form-title" className="text-lg font-semibold mb-4">{drawer ? 'ویرایش معامله' : 'معامله جدید'}</h2>
            <div className="space-y-3">
              <div className="space-y-2">
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
                <Label htmlFor="deal-amount">مبلغ (عدد)</Label>
                <Input
                  id="deal-amount"
                  type="text"
                  placeholder="مبلغ (عدد)"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
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
            <div className="flex gap-2 mt-4 justify-end">
              {drawer && (
                <Button type="button" variant="destructive" onClick={() => handleDelete(drawer.id)} disabled={saving} aria-label="حذف" title="حذف" className="gap-2">
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
