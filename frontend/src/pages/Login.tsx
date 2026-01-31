import * as React from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Moon, Sun } from 'lucide-react';

import { cn } from '@/lib/utils';
import { setAccessToken } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
    <div className={cn('min-h-screen bg-background text-foreground px-4 py-10 aurora-bg')}>
      <div className="mx-auto flex w-full max-w-md items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl" />
          <div className="leading-tight">
            <div className="text-sm font-semibold">Sakhtar CRM</div>
            <div className="text-xs text-muted-foreground">
              {tenantSlug === 'demo' ? 'پنل مدیر فروش' : tenantSlug ? `سازمان: ${tenantSlug}` : 'ورود'}
            </div>
          </div>
        </div>

        <ThemeToggle />
      </div>

      <div className="mx-auto mt-6 w-full max-w-md">
        <Card
          className={cn(
            'rounded-3xl border border-border/40 bg-card/60 dark:bg-card/40 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.35)]'
          )}
        >
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">ورود به پنل</CardTitle>
            <CardDescription className="text-xs">
              موبایل یا ایمیل سازمانی‌تان را وارد کنید. (RTL + تاریخ شمسی در کل سیستم فعال است)
            </CardDescription>
          </CardHeader>

          <CardContent>
            {autoLoginPending ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
                <Loader2 className="size-10 animate-spin" aria-hidden />
                <p className="text-sm font-medium">در حال ورود به پنل مدیر فروش...</p>
              </div>
            ) : (
              <>
                {error ? (
                  <Alert className="mb-4 border-destructive/40 bg-destructive/5">
                    <AlertDescription className="text-sm">{error}</AlertDescription>
                  </Alert>
                ) : null}

                {tenantSlug === 'demo' && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full mb-4"
                    onClick={() => {
                      setIdentifier(DEMO_EMAIL);
                      setPassword(DEMO_PASSWORD);
                      setError(null);
                    }}
                  >
                    پر کردن فرم با اطلاعات پنل مدیر فروش
                  </Button>
                )}

                <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier">موبایل یا ایمیل</Label>
                <Input
                  id="identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="مثلاً 0912xxxxxxx یا name@company.com"
                  autoComplete="username"
                  className={cn('h-11 rounded-2xl bg-background/40 dark:bg-background/20 border-border/50')}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">رمز عبور</Label>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                    disabled
                    title="در MVP فعال می‌شود"
                  >
                    فراموشی رمز عبور
                  </Button>
                </div>

                <div className="relative">
                  <Input
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="رمز عبور"
                    autoComplete="current-password"
                    className={cn('h-11 rounded-2xl pe-11 bg-background/40 dark:bg-background/20 border-border/50')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute inset-y-0 start-2 my-auto h-9 w-9 rounded-xl"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'پنهان کردن رمز' : 'نمایش رمز'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} />
                  مرا به خاطر بسپار
                </label>

                <Link
                  to={tenantSlug ? `/t/${tenantSlug}/app/settings/billing` : '/'}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  وضعیت اشتراک
                </Link>
              </div>

              <Button
                type="submit"
                className={cn(
                  'h-11 w-full rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_16px_40px_hsla(var(--primary)/0.25)]'
                )}
                disabled={loading}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    در حال ورود...
                  </span>
                ) : (
                  'ورود'
                )}
              </Button>

              <div className="pt-2">
                <Separator className="bg-border/50" />
              </div>

              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>پنل مدیر فروش (دمو) — فقط برای مشاهده.</span>
                  <Link to="/t/demo/app" className="hover:text-foreground">
                    مشاهده پنل مدیر فروش
                  </Link>
                </div>
                {tenantSlug === 'demo' && (
                  <p className="text-[11px] opacity-80">
                    دمو = پنل مدیر فروش. اگر ورود خودکار کار نکرد، در پوشهٔ backend دستور <code className="bg-muted px-1 rounded">npx prisma db seed</code> را اجرا کنید.
                  </p>
                )}
              </div>
            </form>
              </>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Sakhtar — CRM
        </div>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const [mounted, setMounted] = React.useState(false);
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('theme');
    const dark = saved ? saved === 'dark' : false;
    setIsDark(dark);
    document.documentElement.classList.toggle('dark', dark);
  }, []);

  if (!mounted) return null;

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      className={cn(
        'h-10 w-10 rounded-2xl border border-border/40 bg-card/50 backdrop-blur-xl hover:bg-card/70'
      )}
      aria-label={isDark ? 'تغییر به حالت روشن' : 'تغییر به حالت تیره'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
