import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageBreadcrumb } from '@/components/PageBreadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { JalaliDateInput } from '@/components/ui/jalali-date-input';
import { useAuth } from '@/contexts/auth-context';
import { getCallsLive, getCallsLogs } from '@/features/calls/api';
import { AgentCallState, CallLogItem, CallStatus, CallsLiveResponse, CallsLogsResponse } from '@/features/calls/types';
import { formatFaNum } from '@/lib/numbers';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock3, PhoneCall, PhoneIncoming, PhoneOutgoing, PlayCircle, Radio, RefreshCw } from 'lucide-react';

type TabKey = 'live' | 'logs';

const CALLS_MODULE_UNAVAILABLE_MESSAGE =
  'ماژول مرکز تماس روی سرور فعال نیست. لطفا بک‌اند را ری‌استارت کنید و مایگریشن‌ها را اجرا کنید.';

const STATUS_OPTIONS: Array<{ value: '' | CallStatus; label: string }> = [
  { value: '', label: 'همه وضعیت‌ها' },
  { value: 'RINGING', label: 'در حال زنگ' },
  { value: 'IN_PROGRESS', label: 'در تماس' },
  { value: 'ANSWERED', label: 'پاسخ داده‌شده' },
  { value: 'MISSED', label: 'از دست رفته' },
  { value: 'FAILED', label: 'ناموفق' },
  { value: 'ENDED', label: 'پایان‌یافته' },
];

const STATE_LABELS: Record<AgentCallState, string> = {
  AVAILABLE: 'آماده',
  RINGING: 'در حال زنگ',
  ON_CALL: 'در تماس',
  AFTER_CALL_WORK: 'پس از تماس',
  OFFLINE: 'آفلاین',
};

const STATE_CLASS: Record<AgentCallState, string> = {
  AVAILABLE: 'bg-emerald-500/12 text-emerald-700 border-emerald-200',
  RINGING: 'bg-amber-500/12 text-amber-700 border-amber-200',
  ON_CALL: 'bg-sky-500/12 text-sky-700 border-sky-200',
  AFTER_CALL_WORK: 'bg-violet-500/12 text-violet-700 border-violet-200',
  OFFLINE: 'bg-slate-500/12 text-slate-700 border-slate-200',
};

const STATUS_LABELS: Record<CallStatus, string> = {
  RINGING: 'در حال زنگ',
  IN_PROGRESS: 'در تماس',
  ANSWERED: 'پاسخ داده‌شده',
  MISSED: 'از دست رفته',
  FAILED: 'ناموفق',
  ENDED: 'پایان‌یافته',
};

const STATUS_CLASS: Record<CallStatus, string> = {
  RINGING: 'bg-amber-500/12 text-amber-700 border-amber-200',
  IN_PROGRESS: 'bg-sky-500/12 text-sky-700 border-sky-200',
  ANSWERED: 'bg-cyan-500/12 text-cyan-700 border-cyan-200',
  MISSED: 'bg-rose-500/12 text-rose-700 border-rose-200',
  FAILED: 'bg-rose-500/12 text-rose-700 border-rose-200',
  ENDED: 'bg-emerald-500/12 text-emerald-700 border-emerald-200',
};

function formatDateTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fa-IR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(value: number | null | undefined) {
  const total = Math.max(0, Math.floor(Number(value ?? 0)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${formatFaNum(hours)}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${formatFaNum(minutes)}:${String(seconds).padStart(2, '0')}`;
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function counterpartNumber(item: CallLogItem) {
  return item.direction === 'INBOUND' ? item.fromNumber : item.toNumber;
}

function isMissingCallsEndpoint(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('cannot get') && normalized.includes('/calls');
}

export default function CallsPage() {
  const { hasPermission } = useAuth();
  const canTeamScope = hasPermission('calls.team.read');

  const [tab, setTab] = useState<TabKey>('logs');
  const [scope, setScope] = useState<'me' | 'team'>(canTeamScope ? 'team' : 'me');

  const [liveData, setLiveData] = useState<CallsLiveResponse | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);

  const [logsData, setLogsData] = useState<CallsLogsResponse | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);

  const today = new Date();
  const weekAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

  const [fromDate, setFromDate] = useState(toIsoDate(weekAgo));
  const [toDate, setToDate] = useState(toIsoDate(today));
  const [status, setStatus] = useState<'' | CallStatus>('');
  const [hasRecording, setHasRecording] = useState<'all' | 'yes' | 'no'>('all');
  const [agentUserId, setAgentUserId] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canTeamScope && scope === 'team') {
      setScope('me');
    }
  }, [canTeamScope, scope]);

  const fetchLive = useCallback(async () => {
    setLiveLoading(true);
    try {
      const response = await getCallsLive(scope);
      setLiveData(response);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'خطا در دریافت وضعیت زنده تماس';
      if (isMissingCallsEndpoint(message)) {
        setLiveData({
          scope,
          serverNowIso: new Date().toISOString(),
          agents: [],
        });
        setError(CALLS_MODULE_UNAVAILABLE_MESSAGE);
      } else {
        setError(message);
      }
    } finally {
      setLiveLoading(false);
    }
  }, [scope]);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const response = await getCallsLogs({
        scope,
        from: fromDate,
        to: toDate,
        status: status || undefined,
        hasRecording: hasRecording === 'all' ? undefined : hasRecording === 'yes',
        agentUserId: canTeamScope && scope === 'team' ? agentUserId || undefined : undefined,
        page,
        pageSize: 20,
      });
      setLogsData(response);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'خطا در دریافت گزارش تماس‌ها';
      if (isMissingCallsEndpoint(message)) {
        setLogsData({
          scope,
          page,
          pageSize: 20,
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
      setLogsLoading(false);
    }
  }, [agentUserId, canTeamScope, fromDate, hasRecording, page, scope, status, toDate]);

  useEffect(() => {
    if (tab !== 'live') return;
    void fetchLive();
    const timer = window.setInterval(() => {
      if (!document.hidden) void fetchLive();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [fetchLive, tab]);

  useEffect(() => {
    if (tab !== 'logs') return;
    void fetchLogs();
    const timer = window.setInterval(() => {
      if (!document.hidden) void fetchLogs();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [fetchLogs, tab]);

  useEffect(() => {
    setPage(1);
  }, [scope, fromDate, toDate, status, hasRecording, agentUserId]);

  const agentOptions = useMemo(() => {
    const byId = new Map<string, { userId: string; name: string }>();
    (liveData?.agents ?? []).forEach((agent) => {
      byId.set(agent.userId, { userId: agent.userId, name: agent.name });
    });
    (logsData?.items ?? []).forEach((item) => {
      if (!byId.has(item.agent.userId)) {
        byId.set(item.agent.userId, { userId: item.agent.userId, name: item.agent.name });
      }
    });
    return Array.from(byId.values());
  }, [liveData?.agents, logsData?.items]);

  return (
    <div className="space-y-6">
      <PageBreadcrumb current="مرکز تماس" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-title-lg font-title">مرکز تماس</h1>
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-2">
            <button
              type="button"
              className={cn(
                'rounded-lg px-3 py-2 text-sm transition-colors',
                tab === 'live' ? 'bg-primary text-primary-foreground' : 'bg-[var(--bg-muted)] text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setTab('live')}
            >
              زنده
            </button>
            <button
              type="button"
              className={cn(
                'rounded-lg px-3 py-2 text-sm transition-colors',
                tab === 'logs' ? 'bg-primary text-primary-foreground' : 'bg-[var(--bg-muted)] text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setTab('logs')}
            >
              گزارش تماس‌ها
            </button>
          </div>
          {canTeamScope && (
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-2">
              <button
                type="button"
                className={cn(
                  'rounded-lg px-3 py-2 text-sm transition-colors',
                  scope === 'me' ? 'bg-primary text-primary-foreground' : 'bg-[var(--bg-muted)] text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setScope('me')}
              >
                من
              </button>
              <button
                type="button"
                className={cn(
                  'rounded-lg px-3 py-2 text-sm transition-colors',
                  scope === 'team' ? 'bg-primary text-primary-foreground' : 'bg-[var(--bg-muted)] text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setScope('team')}
              >
                تیم
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <Card className="rounded-2xl border-rose-300">
          <CardContent className="py-4 text-sm text-rose-600">{error}</CardContent>
        </Card>
      )}

      {tab === 'live' && (
        <Card className="rounded-3xl">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>وضعیت زنده اپراتورها</CardTitle>
              <p className="text-xs text-muted-foreground">بروزرسانی خودکار هر ۱۵ ثانیه</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void fetchLive()}>
              <RefreshCw className="size-4" />
              بروزرسانی
            </Button>
          </CardHeader>
          <CardContent>
            {liveLoading && (liveData?.agents.length ?? 0) === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">در حال دریافت وضعیت زنده...</div>
            ) : (liveData?.agents.length ?? 0) === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">اپراتور فعالی برای نمایش وجود ندارد.</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {liveData?.agents.map((agent) => (
                  <article key={agent.userId} className="rounded-2xl border border-border bg-background/60 p-3">
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
                      <div className="mt-3 space-y-1 text-xs">
                        <div className="inline-flex items-center gap-1 rounded-lg bg-sky-500/10 px-2 py-1 text-sky-700">
                          <Radio className="size-3.5" />
                          <span>{agent.currentCall.direction === 'INBOUND' ? 'تماس ورودی' : 'تماس خروجی'}</span>
                        </div>
                        <div className="fa-num text-sm font-semibold text-foreground">
                          مدت تماس: {formatDuration(agent.currentCall.durationSec)}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 text-xs text-muted-foreground">تماس فعالی ندارد.</div>
                    )}
                    {agent.lastStatus === 'MISSED' && (
                      <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-rose-500/10 px-2 py-1 text-xs text-rose-700">
                        <AlertTriangle className="size-3.5" />
                        آخرین تماس از دست رفته
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'logs' && (
        <div className="space-y-4">
          <Card className="rounded-3xl">
            <CardHeader className="pb-3">
              <CardTitle>فیلتر گزارش تماس</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">از تاریخ</label>
                  <JalaliDateInput value={fromDate} onChange={setFromDate} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">تا تاریخ</label>
                  <JalaliDateInput value={toDate} onChange={setToDate} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">وضعیت</label>
                  <select
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    value={status}
                    onChange={(event) => setStatus(event.target.value as '' | CallStatus)}
                  >
                    {STATUS_OPTIONS.map((item) => (
                      <option key={item.label} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">ضبط مکالمه</label>
                  <select
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    value={hasRecording}
                    onChange={(event) => setHasRecording(event.target.value as 'all' | 'yes' | 'no')}
                  >
                    <option value="all">همه</option>
                    <option value="yes">فقط دارای ضبط</option>
                    <option value="no">بدون ضبط</option>
                  </select>
                </div>
                {canTeamScope && scope === 'team' && (
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">اپراتور</label>
                    <select
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                      value={agentUserId}
                      onChange={(event) => setAgentUserId(event.target.value)}
                    >
                      <option value="">همه اپراتورها</option>
                      {agentOptions.map((agent) => (
                        <option key={agent.userId} value={agent.userId}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex items-end">
                  <Button type="button" variant="outline" className="w-full" onClick={() => void fetchLogs()}>
                    <RefreshCw className="size-4" />
                    بروزرسانی
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            <Card className="rounded-2xl">
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">کل تماس‌ها</p>
                <p className="fa-num mt-1 text-xl font-bold">{formatFaNum(logsData?.summary.total ?? 0)}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">پاسخ داده‌شده</p>
                <p className="fa-num mt-1 text-xl font-bold">{formatFaNum(logsData?.summary.answered ?? 0)}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">از دست رفته</p>
                <p className="fa-num mt-1 text-xl font-bold">{formatFaNum(logsData?.summary.missed ?? 0)}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">ناموفق</p>
                <p className="fa-num mt-1 text-xl font-bold">{formatFaNum(logsData?.summary.failed ?? 0)}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">مدت کل</p>
                <p className="fa-num mt-1 text-xl font-bold">{formatDuration(logsData?.summary.totalDurationSec ?? 0)}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">میانگین مدت</p>
                <p className="fa-num mt-1 text-xl font-bold">{formatDuration(logsData?.summary.avgDurationSec ?? 0)}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-3xl">
            <CardHeader className="pb-2">
              <CardTitle>لیست تماس‌ها</CardTitle>
            </CardHeader>
            <CardContent>
              {logsLoading && (logsData?.items.length ?? 0) === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">در حال دریافت گزارش تماس‌ها...</div>
              ) : (logsData?.items.length ?? 0) === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">تماسی در بازه انتخابی پیدا نشد.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="px-2 py-2 text-right">شروع</th>
                        <th className="px-2 py-2 text-right">اپراتور</th>
                        <th className="px-2 py-2 text-right">شماره</th>
                        <th className="px-2 py-2 text-right">نوع</th>
                        <th className="px-2 py-2 text-right">وضعیت</th>
                        <th className="px-2 py-2 text-right">مدت</th>
                        <th className="px-2 py-2 text-right">ضبط</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logsData?.items.map((item) => (
                        <tr key={item.id} className="border-b border-border/60 align-top">
                          <td className="px-2 py-2 fa-num">{formatDateTime(item.startedAt)}</td>
                          <td className="px-2 py-2">
                            <div className="font-medium">{item.agent.name}</div>
                            <div className="text-xs text-muted-foreground">ext: {item.ext}</div>
                          </td>
                          <td className="px-2 py-2 fa-num">{counterpartNumber(item)}</td>
                          <td className="px-2 py-2">
                            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs">
                              {item.direction === 'INBOUND' ? <PhoneIncoming className="size-3.5" /> : <PhoneOutgoing className="size-3.5" />}
                              {item.direction === 'INBOUND' ? 'ورودی' : 'خروجی'}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs', STATUS_CLASS[item.status])}>
                              {STATUS_LABELS[item.status]}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <span className="inline-flex items-center gap-1 fa-num">
                              <Clock3 className="size-3.5 text-muted-foreground" />
                              {formatDuration(item.durationSec)}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            {item.recordingUrl ? (
                              <div className="flex items-center gap-2">
                                <PlayCircle className="size-4 text-emerald-600" />
                                <audio controls preload="none" src={item.recordingUrl} className="h-8 w-44" />
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">ندارد</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  صفحه {formatFaNum(logsData?.page ?? 1)} از {formatFaNum(logsData?.totalPages ?? 1)}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={(logsData?.page ?? 1) <= 1}
                  >
                    قبلی
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage((prev) =>
                        Math.min(logsData?.totalPages ?? prev + 1, prev + 1),
                      )
                    }
                    disabled={(logsData?.page ?? 1) >= (logsData?.totalPages ?? 1)}
                  >
                    بعدی
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="rounded-2xl border-dashed">
        <CardContent className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
          <PhoneCall className="size-4" />
          ماژول فعلی Mock VOIP است و داده‌ها به‌صورت شبیه‌سازی تولید می‌شوند.
        </CardContent>
      </Card>
    </div>
  );
}
