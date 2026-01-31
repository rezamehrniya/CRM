import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api';
import { formatFaNum } from '../lib/numbers';
import { PageBreadcrumb } from '../components/PageBreadcrumb';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';

type Contact = {
  id: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  companyId?: string | null;
  company?: { id: string; name: string } | null;
};

export default function Contacts() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/t/${tenantSlug}/app`;
  const [data, setData] = useState<{ data: Contact[]; total: number; page: number; pageSize: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [drawer, setDrawer] = useState<Contact | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);

  const pageSize = 25;

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (q.trim()) params.set('q', q.trim());
    apiGet<{ data: Contact[]; total: number; page: number; pageSize: number }>(`/contacts?${params}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, q]);

  const refetch = () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (q.trim()) params.set('q', q.trim());
    apiGet<{ data: Contact[]; total: number }>(`/contacts?${params}`).then((res) =>
      setData({ ...res, page, pageSize })
    );
  };

  const handleCreate = () => {
    setDrawer(null);
    setForm({ fullName: '', phone: '', email: '' });
    setFormOpen(true);
  };

  const closeForm = () => {
    setDrawer(null);
    setFormOpen(false);
    setForm({ fullName: '', phone: '', email: '' });
  };

  const handleSave = async () => {
    if (!form.fullName.trim()) return;
    setSaving(true);
    try {
      if (drawer) {
        await apiPatch(`/contacts/${drawer.id}`, form);
        closeForm();
      } else {
        await apiPost('/contacts', form);
        setForm({ fullName: '', phone: '', email: '' });
        setFormOpen(false);
      }
      refetch();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('حذف این مخاطب؟')) return;
    setSaving(true);
    try {
      await apiDelete(`/contacts/${id}`);
      closeForm();
      refetch();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageBreadcrumb current="مخاطبین" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-title-lg font-title">مخاطبین</h1>
        <div className="flex gap-2">
          <Input
            type="search"
            placeholder="جستجو..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-48 bg-card"
          />
          <Button type="button" onClick={handleCreate}>
            مخاطب جدید
          </Button>
        </div>
      </div>

      {error && (
        <Alert className="mb-4 rounded-card border-destructive/30 bg-destructive/10 text-destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="glass-table-surface overflow-hidden rounded-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-default)] h-11 bg-[var(--bg-toolbar)]">
                <th className="text-start pe-4 ps-4 font-medium">نام</th>
                <th className="text-start pe-4 ps-4 font-medium">تلفن</th>
                <th className="text-start pe-4 ps-4 font-medium">ایمیل</th>
                <th className="text-start pe-4 ps-4 w-20">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b border-[var(--border-default)] h-12">
                  <td className="pe-4 ps-4"><Skeleton className="h-4 w-36" /></td>
                  <td className="pe-4 ps-4"><Skeleton className="h-4 w-28" /></td>
                  <td className="pe-4 ps-4"><Skeleton className="h-4 w-40" /></td>
                  <td className="pe-4 ps-4"><Skeleton className="h-8 w-16" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && data && (
        <>
          <div className="glass-table-surface overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-default)] h-11 bg-[var(--bg-toolbar)]">
                  <th className="text-start pe-4 ps-4 font-medium">نام</th>
                  <th className="text-start pe-4 ps-4 font-medium">تلفن</th>
                  <th className="text-start pe-4 ps-4 font-medium">ایمیل</th>
                  <th className="text-start pe-4 ps-4 w-20">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={4} className="pe-4 ps-4 py-8 text-center text-muted-foreground">
                      مخاطبی یافت نشد.
                    </td>
                  </tr>
                )}
                {data.data.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[var(--border-default)] h-12 hover:bg-[var(--bg-muted)]"
                  >
                    <td className="pe-4 ps-4">
                      <Link to={`${base}/contacts/${c.id}`} className="font-medium text-primary hover:underline">
                        {c.fullName}
                      </Link>
                    </td>
                    <td className="pe-4 ps-4">{c.phone ?? '—'}</td>
                    <td className="pe-4 ps-4">{c.email ?? '—'}</td>
                    <td className="pe-4 ps-4">
                      <Link to={`${base}/contacts/${c.id}`} className="text-sm text-muted-foreground hover:text-foreground ml-2">
                        مشاهده
                      </Link>
                      <Button type="button" variant="link" size="sm" onClick={() => {
                        setDrawer(c);
                        setFormOpen(true);
                        setForm({ fullName: c.fullName, phone: c.phone ?? '', email: c.email ?? '' });
                      }}>
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
              <span className="text-sm text-[var(--muted-foreground)] fa-num">
                {formatFaNum(data.data.length)} از {formatFaNum(data.total)}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  قبلی
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={page * pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>
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
          aria-labelledby="contact-form-title"
        >
          <div
            className="glass-card w-full max-w-md p-6 rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="contact-form-title" className="text-lg font-semibold mb-4">{drawer ? 'ویرایش مخاطب' : 'مخاطب جدید'}</h2>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="contact-fullName">نام کامل</Label>
                <Input
                  id="contact-fullName"
                  type="text"
                  placeholder="نام کامل"
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  className="bg-card"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-phone">تلفن</Label>
                <Input
                  id="contact-phone"
                  type="text"
                  placeholder="تلفن"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="bg-card"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-email">ایمیل</Label>
                <Input
                  id="contact-email"
                  type="email"
                  placeholder="ایمیل"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="bg-card"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              {drawer && (
                <Button type="button" variant="destructive" onClick={() => handleDelete(drawer.id)} disabled={saving}>
                  حذف
                </Button>
              )}
              <Button type="button" variant="outline" onClick={closeForm}>
                انصراف
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving || !form.fullName.trim()}>
                {saving ? 'در حال ذخیره...' : 'ذخیره'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
