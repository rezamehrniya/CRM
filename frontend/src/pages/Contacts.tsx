import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api';

type Contact = {
  id: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  companyId?: string | null;
  company?: { id: string; name: string } | null;
};

export default function Contacts() {
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
    apiGet<{ data: Contact[]; total: number }>(`/contacts?${params}`).then(setData);
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-title-lg font-title">مخاطبین</h1>
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="جستجو..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="rounded-card border border-input px-3 py-2 w-48 bg-card text-foreground"
          />
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-card bg-primary text-primary-foreground px-4 py-2 font-medium hover:opacity-90"
          >
            مخاطب جدید
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-card border border-destructive/30 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {loading && <p className="text-[var(--muted-foreground)]">در حال بارگذاری...</p>}
      {!loading && data && (
        <>
          <div className="glass-table-surface overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border h-11">
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
                    className="border-b border-border h-12 hover:bg-white/5"
                  >
                    <td className="pe-4 ps-4">{c.fullName}</td>
                    <td className="pe-4 ps-4">{c.phone ?? '—'}</td>
                    <td className="pe-4 ps-4">{c.email ?? '—'}</td>
                    <td className="pe-4 ps-4">
                      <button
                        type="button"
                        onClick={() => {
                          setDrawer(c);
                          setFormOpen(true);
                          setForm({ fullName: c.fullName, phone: c.phone ?? '', email: c.email ?? '' });
                        }}
                        className="text-primary font-medium"
                      >
                        ویرایش
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.total > pageSize && (
            <div className="mt-4 flex justify-between items-center">
              <span className="text-sm text-[var(--muted-foreground)]">
                {data.data.length} از {data.total}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-card px-3 py-1 border border-input bg-card disabled:opacity-50"
                >
                  قبلی
                </button>
                <button
                  type="button"
                  disabled={page * pageSize >= data.total}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-card px-3 py-1 border border-input bg-card disabled:opacity-50"
                >
                  بعدی
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {(drawer || formOpen) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50" onClick={closeForm}>
          <div
            className="glass-card w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-4">{drawer ? 'ویرایش مخاطب' : 'مخاطب جدید'}</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="نام کامل"
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                className="w-full border border-input rounded-card px-3 py-2 bg-card text-foreground"
              />
              <input
                type="text"
                placeholder="تلفن"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full border border-input rounded-card px-3 py-2 bg-card text-foreground"
              />
              <input
                type="email"
                placeholder="ایمیل"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full border border-input rounded-card px-3 py-2 bg-card text-foreground"
              />
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              {drawer && (
                <button
                  type="button"
                  onClick={() => handleDelete(drawer.id)}
                  disabled={saving}
                  className="px-4 py-2 text-red-600 dark:text-red-400"
                >
                  حذف
                </button>
              )}
              <button type="button" onClick={closeForm} className="rounded-card px-4 py-2 border border-input bg-card">
                انصراف
              </button>
              <button type="button" onClick={handleSave} disabled={saving || !form.fullName.trim()} className="rounded-card px-4 py-2 bg-primary text-primary-foreground disabled:opacity-50">
                {saving ? 'در حال ذخیره...' : 'ذخیره'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
