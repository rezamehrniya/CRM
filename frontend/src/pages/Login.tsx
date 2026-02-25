import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { extractAccessToken, setAccessToken } from '@/lib/api';

type DemoProfile = 'MANAGER' | 'REP';

const DEMO_TENANT = 'demo';
const DEMO_PASSWORD = (import.meta as any).env?.VITE_DEMO_PASSWORD || '12345678';
const DEMO_ENABLED_BY_ENV = String((import.meta as any).env?.VITE_DEMO ?? '').toLowerCase() === 'true';
const DEMO_PASSWORD_CANDIDATES = ['12345678', '123456'];

const DEMO_USERS: Record<DemoProfile, { label: string; identifier: string; password: string }> = {
  MANAGER: {
    label: 'ورود دموی مدیر فروش',
    identifier:
      (import.meta as any).env?.VITE_DEMO_MANAGER_EMAIL ||
      (import.meta as any).env?.VITE_DEMO_EMAIL ||
      'owner@demo.com',
    password: DEMO_PASSWORD,
  },
  REP: {
    label: 'ورود دموی کارشناس فروش',
    identifier: (import.meta as any).env?.VITE_DEMO_REP_EMAIL || 'seller@demo.com',
    password: DEMO_PASSWORD,
  },
};

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function mapLoginError(raw: string): string {
  const value = String(raw || '').trim();
  const lower = value.toLowerCase();
  if (!value) return 'خطای نامشخص در ورود';
  if (lower.includes('invalid identifier or password')) return 'ایمیل/موبایل یا رمز عبور نادرست است.';
  if (lower.includes('identifier and password required')) return 'ایمیل/موبایل و رمز عبور الزامی است.';
  if (lower.includes('tenant not found')) return 'تنت پیدا نشد.';
  if (lower.includes('failed to fetch') || lower.includes('networkerror')) return 'ارتباط با سرور برقرار نشد.';
  if (lower.includes('unauthorized')) return 'احراز هویت ناموفق بود.';
  return value;
}

export default function Login() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams] = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submitRef = useRef<HTMLButtonElement | null>(null);
  const autoLoginAttemptedRef = useRef(false);

  const isDemoTenant = useMemo(() => {
    return tenantSlug?.trim().toLowerCase() === DEMO_TENANT || DEMO_ENABLED_BY_ENV;
  }, [tenantSlug]);

  const requestedDemoProfile = useMemo<DemoProfile | null>(() => {
    const raw = (searchParams.get('demoAs') || '').trim().toLowerCase();
    if (raw === 'manager') return 'MANAGER';
    if (raw === 'rep') return 'REP';
    return null;
  }, [searchParams]);

  const autoDemoLogin = searchParams.get('auto') === '1';

  function fillDemo(profile: DemoProfile) {
    const selected = DEMO_USERS[profile];
    setIdentifier(selected.identifier);
    setPassword(selected.password);
    setError('');
    queueMicrotask(() => submitRef.current?.focus());
  }

  async function signIn(slug: string, id: string, passwordInput: string) {
    const passwordCandidates = isDemoTenant
      ? Array.from(new Set([passwordInput, DEMO_PASSWORD, ...DEMO_PASSWORD_CANDIDATES]))
      : [passwordInput];

    let lastErrorMessage = '';
    let data: any = null;

    for (const candidate of passwordCandidates) {
      const res = await fetch(`/api/t/${encodeURIComponent(slug)}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phoneOrEmail: id,
          password: candidate,
        }),
      });

      const text = await res.text();
      const parsed = safeJsonParse(text) || {};

      if (res.ok) {
        data = parsed;
        break;
      }

      const msg = parsed?.message || parsed?.error || `خطا در ورود (${res.status})`;
      lastErrorMessage = msg;
      if (!String(msg).toLowerCase().includes('invalid identifier or password')) {
        throw new Error(msg);
      }
    }

    if (!data) {
      throw new Error(lastErrorMessage || 'Invalid identifier or password');
    }

    const accessToken = extractAccessToken(data);
    if (accessToken) {
      setAccessToken(accessToken);
    }
  }

  useEffect(() => {
    if (!isDemoTenant || !requestedDemoProfile || autoLoginAttemptedRef.current) return;

    const selected = DEMO_USERS[requestedDemoProfile];
    setIdentifier(selected.identifier);
    setPassword(selected.password);

    if (!autoDemoLogin) return;

    const slug = tenantSlug?.trim();
    if (!slug) return;

    autoLoginAttemptedRef.current = true;
    setError('');
    setLoading(true);
    void signIn(slug, selected.identifier, selected.password)
      .then(() => {
        navigate(`/t/${slug}/app`, { replace: true });
      })
      .catch((err: any) => {
        setError(mapLoginError(err?.message || 'خطای نامشخص در ورود'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [autoDemoLogin, isDemoTenant, navigate, requestedDemoProfile, tenantSlug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const slug = tenantSlug?.trim();
    if (!slug) return setError('Tenant در آدرس مشخص نیست.');
    if (!identifier.trim()) return setError('ایمیل یا موبایل را وارد کنید.');
    if (!password) return setError('رمز عبور را وارد کنید.');

    setLoading(true);
    try {
      await signIn(slug, identifier.trim(), password);
      navigate(`/t/${slug}/app`);
    } catch (err: any) {
      setError(mapLoginError(err?.message || 'خطای نامشخص در ورود'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen w-full bg-[radial-gradient(circle_at_20%_0%,#102444_0%,#08152b_45%,#050b17_100%)] p-4"
    >
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center">
        <div className="w-full rounded-2xl border border-slate-700/60 bg-slate-900/55 p-6 shadow-2xl backdrop-blur-xl sm:p-7">
          <div className="text-xs font-semibold text-slate-300">Sakhtar CRM</div>
          <h1 className="mt-4 text-2xl font-bold text-white">ورود به پنل</h1>
          <p className="mt-1 text-sm text-slate-300">
            برای دمو یکی از گزینه ها را انتخاب کن یا دستی وارد شو.
          </p>

          {isDemoTenant && (
            <div className="mt-5 grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => fillDemo('MANAGER')}
                className="h-11 rounded-xl border border-slate-600/80 bg-slate-800/70 text-sm font-medium text-slate-100 transition hover:bg-slate-700/80"
              >
                {DEMO_USERS.MANAGER.label}
              </button>
              <button
                type="button"
                onClick={() => fillDemo('REP')}
                className="h-11 rounded-xl border border-slate-600/80 bg-slate-800/70 text-sm font-medium text-slate-100 transition hover:bg-slate-700/80"
              >
                {DEMO_USERS.REP.label}
              </button>
            </div>
          )}

          <div className="my-5 h-px bg-slate-700/70" />

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-300">ایمیل یا موبایل</span>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="مثلا owner@demo.com"
                autoComplete="username"
                className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-left text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-slate-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-slate-300">رمز عبور</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="رمز عبور"
                autoComplete="current-password"
                className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-left text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-slate-500"
              />
            </label>

            {error ? (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-200">
                {error}
              </div>
            ) : null}

            <button
              ref={submitRef}
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-xl bg-blue-600 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'در حال ورود...' : 'ورود'}
            </button>
          </form>

          <p className="mt-4 text-[11px] text-slate-400">Tenant: {tenantSlug || DEMO_TENANT}</p>
          <p className="mt-1 text-[11px] text-slate-400">
            پشتیبانی: <a href="tel:02128426182" className="text-slate-200 hover:text-white">021-28426182</a>
          </p>
        </div>
      </div>
    </div>
  );
}
