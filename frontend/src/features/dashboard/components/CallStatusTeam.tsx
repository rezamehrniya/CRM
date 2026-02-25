import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { getCallsLive } from '@/features/calls/api';
import { CallsLiveResponse } from '@/features/calls/types';
import { formatFaNum } from '@/lib/numbers';
import { cn } from '@/lib/utils';
import { PhoneCall, Radio, RefreshCw } from 'lucide-react';

const CALLS_MODULE_UNAVAILABLE_MESSAGE =
  'ماژول مرکز تماس روی سرور فعال نیست. لطفا بک‌اند را ری‌استارت کنید و مایگریشن‌ها را اجرا کنید.';

const STATE_LABELS = {
  AVAILABLE: 'آماده',
  RINGING: 'در حال زنگ',
  ON_CALL: 'در تماس',
  AFTER_CALL_WORK: 'پس از تماس',
  OFFLINE: 'آفلاین',
} as const;

function isMissingCallsEndpoint(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('cannot get') && normalized.includes('/calls');
}

const STATE_CLASS = {
  AVAILABLE: 'bg-emerald-500/12 text-emerald-700 border-emerald-200',
  RINGING: 'bg-amber-500/12 text-amber-700 border-amber-200',
  ON_CALL: 'bg-sky-500/12 text-sky-700 border-sky-200',
  AFTER_CALL_WORK: 'bg-violet-500/12 text-violet-700 border-violet-200',
  OFFLINE: 'bg-slate-500/12 text-slate-700 border-slate-200',
} as const;

function formatDuration(value: number | null | undefined) {
  const total = Math.max(0, Math.floor(Number(value ?? 0)));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${formatFaNum(minutes)}:${String(seconds).padStart(2, '0')}`;
}

export function CallStatusTeam() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/t/${tenantSlug}/app`;
  const { hasPermission } = useAuth();
  const canReadCalls = hasPermission('calls.read');

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CallsLiveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLive = useCallback(async () => {
    if (!canReadCalls) return;
    setLoading(true);
    try {
      const response = await getCallsLive('team');
      setData(response);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'خطا در دریافت وضعیت تماس تیم.';
      if (isMissingCallsEndpoint(message)) {
        setData({ scope: 'team', serverNowIso: new Date().toISOString(), agents: [] });
        setError(CALLS_MODULE_UNAVAILABLE_MESSAGE);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [canReadCalls]);

  useEffect(() => {
    if (!canReadCalls) return;
    void fetchLive();
    const timer = window.setInterval(() => {
      if (!document.hidden) void fetchLive();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [canReadCalls, fetchLive]);

  if (!canReadCalls) return null;

  return (
    <Card className="rounded-3xl border-slate-200/70">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div>
          <CardTitle>وضعیت تماس تیم.</CardTitle>
          <p className="text-xs text-muted-foreground">نمای زنده اپراتورها (بروزرسانی هر ۱۵ ثانیه)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void fetchLive()}>
            <RefreshCw className="size-4" />
            بروزرسانی
          </Button>
          <Button type="button" size="sm" onClick={() => navigate(`${base}/calls`)}>
            <PhoneCall className="size-4" />
            مشاهده گزارش تماس‌ها
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="rounded-xl border border-rose-300 bg-rose-500/5 px-3 py-2 text-sm text-rose-600">{error}</div>
        ) : loading && (data?.agents.length ?? 0) === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">در حال دریافت وضعیت تیم...</div>
        ) : (data?.agents.length ?? 0) === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">اپراتوری برای نمایش وجود ندارد.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data?.agents.map((agent) => (
              <article key={agent.userId} className="rounded-2xl border border-border/70 bg-background/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">داخلی: {agent.ext}</p>
                  </div>
                  <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', STATE_CLASS[agent.state])}>
                    {STATE_LABELS[agent.state]}
                  </span>
                </div>
                {agent.currentCall ? (
                  <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-sky-500/10 px-2 py-1 text-xs text-sky-700">
                    <Radio className="size-3.5" />
                    {agent.currentCall.direction === 'INBOUND' ? 'ورودی' : 'خروجی'}
                    <span className="fa-num">{formatDuration(agent.currentCall.durationSec)}</span>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">تماس فعال ندارد.</p>
                )}
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}




