import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { getCallsLogs } from '@/features/calls/api';
import { CallsLogsResponse } from '@/features/calls/types';
import { formatFaNum } from '@/lib/numbers';
import { AlertTriangle, Clock3, PhoneCall, PhoneIncoming, PhoneOutgoing, PlayCircle } from 'lucide-react';

const CALLS_MODULE_UNAVAILABLE_MESSAGE =
  'ماژول مرکز تماس روی سرور فعال نیست. لطفا بک‌اند را ری‌استارت کنید و مایگریشن‌ها را اجرا کنید.';

const STATUS_LABELS = {
  RINGING: 'در حال زنگ',
  IN_PROGRESS: 'در تماس',
  ANSWERED: 'پاسخ داده‌شده',
  MISSED: 'از دست رفته',
  FAILED: 'ناموفق',
  ENDED: 'پایان‌یافته',
} as const;

function isMissingCallsEndpoint(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('cannot get') && normalized.includes('/calls');
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDuration(value: number | null | undefined) {
  const total = Math.max(0, Math.floor(Number(value ?? 0)));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${formatFaNum(minutes)}:${String(seconds).padStart(2, '0')}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fa-IR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MyCallsToday() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/t/${tenantSlug}/app`;
  const { hasPermission } = useAuth();
  const canReadCalls = hasPermission('calls.read');

  const [data, setData] = useState<CallsLogsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayRange = useMemo(() => {
    const now = new Date();
    const date = toIsoDate(now);
    return { from: date, to: date };
  }, []);

  const fetchTodayCalls = useCallback(async () => {
    if (!canReadCalls) return;
    setLoading(true);
    try {
      const response = await getCallsLogs({
        scope: 'me',
        from: todayRange.from,
        to: todayRange.to,
        page: 1,
        pageSize: 5,
      });
      setData(response);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'خطا در دریافت تماس‌های امروز';
      if (isMissingCallsEndpoint(message)) {
        setData({
          scope: 'me',
          page: 1,
          pageSize: 5,
          total: 0,
          totalPages: 1,
          summary: {
            total: 0,
            answered: 0,
            missed: 0,
            failed: 0,
            inProgress: 0,
            withRecording: 0,
            totalDurationSec: 0,
            avgDurationSec: 0,
          },
          items: [],
        });
        setError(CALLS_MODULE_UNAVAILABLE_MESSAGE);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [canReadCalls, todayRange.from, todayRange.to]);

  useEffect(() => {
    if (!canReadCalls) return;
    void fetchTodayCalls();
    const timer = window.setInterval(() => {
      if (!document.hidden) void fetchTodayCalls();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [canReadCalls, fetchTodayCalls]);

  if (!canReadCalls) return null;

  return (
    <Card className="rounded-3xl border-slate-200/70">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div>
          <CardTitle>تماس‌های من امروز</CardTitle>
          <p className="text-xs text-muted-foreground">جمع تماس‌ها، مدت مکالمه و آخرین تماس‌ها</p>
        </div>
        <Button type="button" size="sm" onClick={() => navigate(`${base}/calls`)}>
          <PhoneCall className="size-4" />
          مرکز تماس
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-xl border border-rose-300 bg-rose-500/5 px-3 py-2 text-sm text-rose-600">{error}</div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
            <p className="text-xs text-muted-foreground">کل امروز</p>
            <p className="fa-num mt-1 text-lg font-bold">{formatFaNum(data?.summary.total ?? 0)}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
            <p className="text-xs text-muted-foreground">از دست رفته</p>
            <p className="fa-num mt-1 text-lg font-bold">{formatFaNum(data?.summary.missed ?? 0)}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
            <p className="text-xs text-muted-foreground">در حال تماس</p>
            <p className="fa-num mt-1 text-lg font-bold">{formatFaNum(data?.summary.inProgress ?? 0)}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
            <p className="text-xs text-muted-foreground">مدت کل</p>
            <p className="fa-num mt-1 text-lg font-bold">{formatDuration(data?.summary.totalDurationSec ?? 0)}</p>
          </div>
        </div>

        {loading && (data?.items.length ?? 0) === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">در حال دریافت تماس‌های امروز...</div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            تماسی ثبت‌شده‌ای برای امروز وجود ندارد.
          </div>
        ) : (
          <ul className="space-y-2">
            {data?.items.map((item) => (
              <li key={item.id} className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-sm font-medium">
                    {item.direction === 'INBOUND' ? <PhoneIncoming className="size-4 text-emerald-600" /> : <PhoneOutgoing className="size-4 text-sky-600" />}
                    <span className="fa-num">{item.direction === 'INBOUND' ? item.fromNumber : item.toNumber}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="size-3.5" />
                      <span className="fa-num">{formatDuration(item.durationSec)}</span>
                    </span>
                    <span className="fa-num">{formatDateTime(item.startedAt)}</span>
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">وضعیت: {STATUS_LABELS[item.status]}</span>
                  {item.recordingUrl ? (
                    <div className="flex items-center gap-2">
                      <PlayCircle className="size-4 text-emerald-600" />
                      <audio controls preload="none" src={item.recordingUrl} className="h-8 w-40" />
                    </div>
                  ) : item.status === 'MISSED' ? (
                    <span className="inline-flex items-center gap-1 text-xs text-rose-600">
                      <AlertTriangle className="size-3.5" />
                      بدون ضبط
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">بدون ضبط</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}




