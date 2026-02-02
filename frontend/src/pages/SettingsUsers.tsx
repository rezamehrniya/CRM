/**
 * زیرصفحهٔ تنظیمات: مدیریت کاربران و نقش‌ها — فقط OWNER.
 * فقط شماره تلفن پذیرفته می‌شود؛ شماره تلفن به‌عنوان نام کاربری (برای ورود) استفاده می‌شود.
 */
import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Users, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { apiGet, apiPost } from '@/lib/api';
import { digitsToFa } from '@/lib/numbers';
import { ErrorPage } from '@/components/error-page';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Member = {
  id: string;
  role: string;
  status: string;
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    status: string;
  };
};

export default function SettingsUsers() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { role, loading: authLoading } = useAuth();
  const base = `/t/${tenantSlug}/app`;
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addPhone, setAddPhone] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const refetch = () => {
    if (role !== 'OWNER') return;
    apiGet<Member[]>('/settings/members')
      .then((data) => setMembers(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    if (role !== 'OWNER') return;
    setLoading(true);
    apiGet<Member[]>('/settings/members')
      .then((data) => setMembers(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [role]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    const phone = addPhone.trim();
    const password = addPassword.trim();
    if (!phone) {
      setAddError('شماره تلفن الزامی است.');
      return;
    }
    if (!password || password.length < 8) {
      setAddError('رمز عبور اولیه حداقل ۸ کاراکتر باشد.');
      return;
    }
    setAddSaving(true);
    try {
      await apiPost('/settings/members', { phone, password });
      setAddPhone('');
      setAddPassword('');
      refetch();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'خطا در افزودن عضو');
    } finally {
      setAddSaving(false);
    }
  };

  if (authLoading) {
    return <div className="text-muted-foreground">در حال بارگذاری...</div>;
  }

  if (role !== 'OWNER') {
    return (
      <ErrorPage
        variant="403"
        title="دسترسی غیرمجاز"
        description="فقط مدیر می‌تواند به مدیریت کاربران دسترسی داشته باشد."
        actionHref={`${base}/settings`}
        actionLabel="برگشت به تنظیمات"
        inline
      />
    );
  }

  const roleLabel = (r: string) => (r === 'OWNER' ? 'مدیر' : 'فروشنده');
  const statusLabel = (s: string) =>
    s === 'ACTIVE' ? 'فعال' : s === 'INVITED' ? 'دعوت‌شده' : s === 'DISABLED' ? 'غیرفعال' : s;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to={`${base}/settings`} className="hover:text-foreground">
          تنظیمات
        </Link>
        <ArrowRight className="size-4" aria-hidden />
        <span className="text-foreground">مدیریت کاربران</span>
      </div>
      <h1 className="text-title-lg font-title">مدیریت کاربران و نقش‌ها</h1>

      {error && (
        <div className="rounded-card border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="glass-card rounded-card p-5 max-w-md">
        <h2 className="font-title text-base mb-3">افزودن عضو</h2>
        <p className="text-sm text-muted-foreground mb-3">
          فقط شماره تلفن؛ شماره تلفن به‌عنوان نام کاربری برای ورود استفاده می‌شود.
        </p>
        <form onSubmit={handleAddMember} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="member-phone">شماره تلفن (نام کاربری ورود)</Label>
            <Input
              id="member-phone"
              type="tel"
              placeholder="مثال: ۰۹۱۲۳۴۵۶۷۸۹"
              value={addPhone}
              onChange={(e) => setAddPhone(e.target.value)}
              className="bg-card"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-password">رمز عبور اولیه (حداقل ۸ کاراکتر)</Label>
            <Input
              id="member-password"
              type="password"
              placeholder="رمز عبور اولیه"
              value={addPassword}
              onChange={(e) => setAddPassword(e.target.value)}
              minLength={8}
              className="bg-card"
            />
          </div>
          {addError && <p className="text-sm text-destructive">{addError}</p>}
          <Button type="submit" disabled={addSaving}>
            {addSaving ? 'در حال افزودن...' : 'افزودن عضو'}
          </Button>
        </form>
      </div>

      {loading ? (
        <div className="glass-card rounded-card p-5 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : members.length === 0 ? (
        <div className="glass-card rounded-card p-5">
          <p className="text-sm text-muted-foreground">هنوز کاربری در این Tenant ثبت نشده است.</p>
        </div>
      ) : (
        <div className="glass-card rounded-card p-5 overflow-x-auto">
          <div className="flex items-center gap-2 mb-3">
            <Users className="size-5 text-primary" aria-hidden />
            <h2 className="font-title text-base">اعضا</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-start p-2 font-medium">شماره تلفن (نام کاربری)</th>
                <th className="text-start p-2 font-medium">نقش</th>
                <th className="text-start p-2 font-medium">وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-border">
                  <td className="p-2 fa-num">{digitsToFa(m.user.phone ?? '')}</td>
                  <td className="p-2">{roleLabel(m.role)}</td>
                  <td className="p-2">{statusLabel(m.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Link
        to={`${base}/settings`}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-input bg-transparent px-4 py-2 font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        برگشت به تنظیمات
      </Link>
    </div>
  );
}
