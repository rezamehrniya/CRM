import * as React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

import { setAccessToken } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

const DEMO_EMAIL = 'owner@demo.com';
const DEMO_PASSWORD = '12345678';

/**
 * Route: /t/:tenantSlug/app/login
 * API: POST /api/t/:tenantSlug/auth/login
 * برای tenant با slug `demo`: پنل مدیر فروش — ورود خودکار با کاربر دمو (بدون فرم).
 */
export default function LoginPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [remember, setRemember] = React.useState(true);
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [autoLoginPending, setAutoLoginPending] = React.useState(false);
  const autoLoginAttempted = React.useRef(false);
  const { refetch } = useAuth();

  const redirectTo = (location.state as { from?: string })?.from ?? (tenantSlug ? `/t/${tenantSlug}/app/dashboard` : '/');

  React.useEffect(() => {
    document.documentElement.setAttribute('dir', 'rtl');
  }, []);

  // ورود خودکار پنل مدیر فروش (دمو): فقط برای tenant با slug `demo`، یک بار
  React.useEffect(() => {
    if (tenantSlug !== 'demo' || autoLoginAttempted.current) return;
    autoLoginAttempted.current = true;
    setAutoLoginPending(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(`/api/t/demo/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            phoneOrEmail: DEMO_EMAIL,
            password: DEMO_PASSWORD,
            remember: true,
          }),
        });

        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
          accessToken?: string;
        };

        if (res.ok && data.accessToken) {
          setAccessToken(data.accessToken);
          await refetch();
          navigate(redirectTo, { replace: true });
          return;
        }
      } catch {
        /**/
      }
      setAutoLoginPending(false);
      setError('ورود خودکار در دسترس نیست. با owner@demo.com و رمز 12345678 وارد پنل مدیر فروش شوید.');
      if (tenantSlug === 'demo') {
        setIdentifier(DEMO_EMAIL);
        setPassword(DEMO_PASSWORD);
      }
    })();
  }, [tenantSlug, navigate, redirectTo, refetch]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!tenantSlug) {
      setError('سازمان مشخص نیست. لطفاً از لینک صحیح وارد شوید.');
      return;
    }
    if (!identifier.trim() || !password) {
      setError('لطفاً موبایل/ایمیل و رمز عبور را وارد کنید.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/t/${encodeURIComponent(tenantSlug)}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phoneOrEmail: identifier.trim(),
          password,
          remember,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        accessToken?: string;
      };

      if (!res.ok) {
        const msg = data?.message ?? data?.error ?? 'ورود ناموفق بود. دوباره تلاش کنید.';
        throw new Error(msg);
      }

      if (data.accessToken) {
        setAccessToken(data.accessToken);
      }

      navigate(redirectTo, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'خطای غیرمنتظره رخ داد.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-default)] text-foreground flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6">
          <img src="/sakhtarlogo.png" alt="" className="h-10 w-10 object-contain shrink-0" />
          <span className="text-xl font-semibold text-foreground">ساختار</span>
        </div>

        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-default)] p-5 shadow-sm">
          {autoLoginPending ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="size-8 animate-spin" aria-hidden />
              <p className="text-sm">در حال ورود...</p>
            </div>
          ) : (
            <>
              {error && (
                <p className="text-xs text-destructive mb-3 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
                  {error}
                </p>
              )}

              {tenantSlug === 'demo' && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground mb-3 underline"
                  onClick={() => {
                    setIdentifier(DEMO_EMAIL);
                    setPassword(DEMO_PASSWORD);
                    setError(null);
                  }}
                >
                  استفاده از دمو (owner@demo.com)
                </button>
              )}

              <form onSubmit={onSubmit} className="space-y-3">
                <div>
                  <Label htmlFor="identifier" className="text-xs">موبایل یا ایمیل</Label>
                  <Input
                    id="identifier"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="موبایل یا ایمیل"
                    autoComplete="username"
                    className="mt-1 h-10 rounded-lg text-left border-2 border-[#94A3B8] dark:border-[#475569] bg-[var(--bg-default)] focus-visible:border-[#64748B] dark:focus-visible:border-[#64748B]"
                  />
                </div>

                <div>
                  <Label htmlFor="password" className="text-xs">رمز عبور</Label>
                  <div className="relative mt-1">
                    <Input
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="رمز عبور"
                      autoComplete="current-password"
                      className="h-10 rounded-lg ps-10 text-left border-2 border-[#94A3B8] dark:border-[#475569] bg-[var(--bg-default)] focus-visible:border-[#64748B] dark:focus-visible:border-[#64748B]"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 start-0 flex items-center justify-center w-10 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'پنهان کردن رمز' : 'نمایش رمز'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs cursor-pointer text-muted-foreground">
                  <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} className="size-3.5" />
                  مرا به خاطر بسپار
                </label>

                <Button
                  type="submit"
                  className="h-10 w-full rounded-lg font-medium"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      ورود...
                    </span>
                  ) : (
                    'ورود'
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
