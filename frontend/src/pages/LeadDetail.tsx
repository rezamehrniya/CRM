import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  FileText,
  MessageSquareText,
  PhoneCall,
  Plus,
  RefreshCw,
  StickyNote,
  Target,
} from 'lucide-react';

import { PageBreadcrumb } from '@/components/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { JalaliDateInput } from '@/components/ui/jalali-date-input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import { formatJalali } from '@/lib/date';
import { formatFaNum } from '@/lib/numbers';

type TimelineItemType =
  | 'TASK'
  | 'CALL'
  | 'SMS'
  | 'QUOTE'
  | 'NOTE'
  | 'STAGE'
  | 'ASSIGN'
  | 'LEAD_FOLLOWUP';

type TimelineItem = {
  id: string;
  type: TimelineItemType;
  ts: string;
  title: string;
  subtitle: string;
  status: string | null;
  preview: string | null;
  ref: Record<string, string>;
  meta: Record<string, unknown>;
};

type LeadTimelineResponse = {
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    companyName: string | null;
    status: string;
    source: string | null;
    followUpAt: string | null;
    ownerUserId: string | null;
    ownerName: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  };
  summary: {
    totalItems: number;
    overdueTasks: number;
    waitingQuotes: number;
    lastTouchAt: string | null;
    lastTouchType: TimelineItemType | null;
  };
  items: TimelineItem[];
  nextCursor: string | null;
};

type PipelineStage = {
  id: string;
  name: string;
};

type Pipeline = {
  id: string;
  name: string;
  isDefault: boolean;
  stages: PipelineStage[];
};

type DetailTab = 'timeline' | 'overview' | 'quotes' | 'tasks' | 'calls' | 'sms';

const TIMELINE_TYPES: Array<{ value: TimelineItemType; label: string }> = [
  { value: 'TASK', label: 'کار' },
  { value: 'CALL', label: 'تماس' },
  { value: 'SMS', label: 'پیامک' },
  { value: 'QUOTE', label: 'پیش‌فاکتور' },
  { value: 'NOTE', label: 'یادداشت' },
  { value: 'STAGE', label: 'مرحله' },
  { value: 'ASSIGN', label: 'ارجاع' },
  { value: 'LEAD_FOLLOWUP', label: 'پیگیری' },
];

const TYPE_COLORS: Record<TimelineItemType, string> = {
  TASK: 'bg-blue-100 text-blue-700 border-blue-200',
  CALL: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  SMS: 'bg-amber-100 text-amber-700 border-amber-200',
  QUOTE: 'bg-violet-100 text-violet-700 border-violet-200',
  NOTE: 'bg-slate-100 text-slate-700 border-slate-200',
  STAGE: 'bg-rose-100 text-rose-700 border-rose-200',
  ASSIGN: 'bg-pink-100 text-pink-700 border-pink-200',
  LEAD_FOLLOWUP: 'bg-orange-100 text-orange-700 border-orange-200',
};

const TAB_LABELS: Array<{ key: DetailTab; label: string }> = [
  { key: 'timeline', label: 'تایم‌لاین' },
  { key: 'overview', label: 'نمای کلی' },
  { key: 'quotes', label: 'پیش‌فاکتورها' },
  { key: 'tasks', label: 'کارها' },
  { key: 'calls', label: 'تماس‌ها' },
  { key: 'sms', label: 'پیامک‌ها' },
];

function typeLabel(type: TimelineItemType): string {
  return TIMELINE_TYPES.find((item) => item.value === type)?.label ?? type;
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\u200c/g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function daysSince(iso: string | null): string {
  if (!iso) return 'نامشخص';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'نامشخص';
  const diff = Math.max(0, Math.ceil((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)));
  return `${formatFaNum(diff)} روز پیش`;
}

function itemVisibleForTab(item: TimelineItem, tab: DetailTab): boolean {
  if (tab === 'timeline' || tab === 'overview') return true;
  if (tab === 'quotes') return item.type === 'QUOTE';
  if (tab === 'tasks') return item.type === 'TASK';
  if (tab === 'calls') return item.type === 'CALL';
  return item.type === 'SMS';
}

function pickQuoteStage(pipelines: Pipeline[]): { pipelineId: string; stageId: string } | null {
  if (pipelines.length === 0) return null;
  const scoreStage = (stageName: string): number => {
    const normalized = normalizeText(stageName);
    if (normalized.includes('quote') || normalized.includes('پیش') || normalized.includes('ارسال')) return 4;
    if (normalized.includes('negotiation') || normalized.includes('مذاکر')) return 3;
    if (normalized.includes('qualified') || normalized.includes('واجد')) return 2;
    if (normalized.includes('cold') || normalized.includes('new') || normalized.includes('جدید')) return 1;
    return 0;
  };

  const defaultPipeline = pipelines.find((item) => item.isDefault) ?? pipelines[0];
  const rankedStages = [...defaultPipeline.stages].sort((a, b) => scoreStage(b.name) - scoreStage(a.name));
  const stage = rankedStages[0] ?? defaultPipeline.stages[0];
  if (!stage) return null;

  return { pipelineId: defaultPipeline.id, stageId: stage.id };
}

export default function LeadDetail() {
  const { tenantSlug, id } = useParams<{ tenantSlug: string; id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const base = `/t/${tenantSlug}/app`;

  const [tab, setTab] = useState<DetailTab>('timeline');
  const [leadData, setLeadData] = useState<LeadTimelineResponse['lead'] | null>(null);
  const [summary, setSummary] = useState<LeadTimelineResponse['summary'] | null>(null);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedTypes, setSelectedTypes] = useState<TimelineItemType[]>(TIMELINE_TYPES.map((item) => item.value));
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueAt, setTaskDueAt] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [quoteTitle, setQuoteTitle] = useState('');
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  const canWriteTasks = hasPermission('tasks.write');
  const canWriteSms = hasPermission('sms.write');
  const canWriteLead = hasPermission('leads.write');
  const canWriteQuote = hasPermission('quotes.write');

  const fetchTimeline = useCallback(
    async (cursor?: string, append = false) => {
      if (!id) return;
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set('limit', '30');
        if (selectedTypes.length > 0) {
          params.set('type', selectedTypes.join(','));
        }
        if (dateFrom) params.set('from', dateFrom);
        if (dateTo) params.set('to', dateTo);
        if (cursor) params.set('cursor', cursor);

        const response = await apiGet<LeadTimelineResponse>(`/timeline/lead/${id}?${params.toString()}`);
        setLeadData(response.lead);
        setSummary(response.summary);
        setItems((prev) => (append ? [...prev, ...response.items] : response.items));
        setNextCursor(response.nextCursor);
      } catch (fetchError: unknown) {
        const message = fetchError instanceof Error ? fetchError.message : 'خطا در دریافت تایم‌لاین';
        setError(message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [dateFrom, dateTo, id, selectedTypes],
  );

  useEffect(() => {
    void fetchTimeline();
  }, [fetchTimeline]);

  const toggleType = (type: TimelineItemType) => {
    setSelectedTypes((prev) => {
      if (prev.includes(type)) {
        const next = prev.filter((value) => value !== type);
        return next.length > 0 ? next : prev;
      }
      return [...prev, type];
    });
  };

  const refreshTimeline = async () => {
    await fetchTimeline(undefined, false);
  };

  const onMarkTaskDone = async (taskId: string) => {
    if (!canWriteTasks) return;
    setQuickError(null);
    try {
      await apiPatch(`/tasks/${taskId}`, { status: 'done' });
      setItems((prev) =>
        prev.map((item) =>
          item.ref.taskId === taskId
            ? {
                ...item,
                status: 'done',
              }
            : item,
        ),
      );
      await refreshTimeline();
    } catch (actionError: unknown) {
      const message = actionError instanceof Error ? actionError.message : 'خطا در بروزرسانی کار';
      setQuickError(message);
    }
  };

  const onCreateTask = async () => {
    if (!id || !canWriteTasks || !taskTitle.trim() || quickBusy) return;
    setQuickBusy(true);
    setQuickError(null);
    try {
      await apiPost('/tasks', {
        title: taskTitle.trim(),
        dueAt: taskDueAt ? `${taskDueAt}T09:00:00.000Z` : undefined,
        description: `Lead timeline follow-up (${id})`,
      });
      setTaskTitle('');
      setTaskDueAt('');
      await refreshTimeline();
    } catch (actionError: unknown) {
      const message = actionError instanceof Error ? actionError.message : 'خطا در ایجاد کار';
      setQuickError(message);
    } finally {
      setQuickBusy(false);
    }
  };

  const onSendSms = async () => {
    if (!leadData?.phone || !canWriteSms || !smsBody.trim() || quickBusy) return;
    setQuickBusy(true);
    setQuickError(null);
    try {
      await apiPost('/sms/send', {
        recipientPhone: leadData.phone,
        recipientName: leadData.fullName,
        body: smsBody.trim(),
      });
      setSmsBody('');
      await refreshTimeline();
    } catch (actionError: unknown) {
      const message = actionError instanceof Error ? actionError.message : 'خطا در ارسال پیامک';
      setQuickError(message);
    } finally {
      setQuickBusy(false);
    }
  };

  const onAppendNote = async () => {
    if (!id || !canWriteLead || !noteBody.trim() || quickBusy) return;
    setQuickBusy(true);
    setQuickError(null);
    try {
      const current = String(leadData?.notes ?? '').trim();
      const stamp = `\n[${new Date().toISOString()}] ${noteBody.trim()}`;
      const nextNotes = current ? `${current}${stamp}` : noteBody.trim();
      await apiPatch(`/leads/${id}`, { notes: nextNotes });
      setLeadData((prev) => (prev ? { ...prev, notes: nextNotes } : prev));
      setNoteBody('');
      await refreshTimeline();
    } catch (actionError: unknown) {
      const message = actionError instanceof Error ? actionError.message : 'خطا در ثبت یادداشت';
      setQuickError(message);
    } finally {
      setQuickBusy(false);
    }
  };

  const onCreateQuote = async () => {
    if (!canWriteQuote || quickBusy) return;
    setQuickBusy(true);
    setQuickError(null);
    try {
      const pipelines = await apiGet<Pipeline[]>('/pipelines');
      const stageRef = pickQuoteStage(pipelines);
      if (!stageRef) {
        throw new Error('Pipeline stage not available');
      }

      await apiPost('/quotes', {
        title: quoteTitle.trim() || `پیش‌فاکتور ${leadData?.fullName ?? 'Lead'}`,
        stageId: stageRef.stageId,
        pipelineId: stageRef.pipelineId,
      });

      setQuoteTitle('');
      await refreshTimeline();
      setTab('quotes');
    } catch (actionError: unknown) {
      const message = actionError instanceof Error ? actionError.message : 'خطا در ایجاد پیش‌فاکتور';
      setQuickError(message);
    } finally {
      setQuickBusy(false);
    }
  };

  const copySmsText = async (item: TimelineItem) => {
    const text = item.preview ?? '';
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // noop
    }
  };

  const visibleItems = useMemo(() => items.filter((item) => itemVisibleForTab(item, tab)), [items, tab]);

  if (!id) {
    return (
      <div className="space-y-4">
        <PageBreadcrumb current="جزئیات لید" />
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">شناسه لید معتبر نیست.</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageBreadcrumb current="جزئیات لید" />

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{leadData?.fullName ?? 'جزئیات لید'}</h1>
          <p className="text-sm text-slate-600">نمای 360 درجه تعاملات مشتری</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => navigate(`${base}/leads`)}>
            بازگشت
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void refreshTimeline()} disabled={loading}>
            <RefreshCw className="ms-1 size-4" />
            بروزرسانی
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="space-y-4 lg:col-span-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-2">
              <div className="flex flex-wrap items-center gap-2">
                {TAB_LABELS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTab(item.key)}
                    className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                      tab === item.key
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-[var(--bg-muted)] text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="timeline-from">از تاریخ</Label>
                <JalaliDateInput id="timeline-from" value={dateFrom} onChange={setDateFrom} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="timeline-to">تا تاریخ</Label>
                <JalaliDateInput id="timeline-to" value={dateTo} onChange={setDateTo} />
              </div>
              <div className="md:col-span-2 space-y-1">
                <Label>نوع رویداد</Label>
                <div className="flex flex-wrap gap-2">
                  {TIMELINE_TYPES.map((type) => {
                    const active = selectedTypes.includes(type.value);
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => toggleType(type.value)}
                        className={`rounded-full border px-2 py-1 text-xs ${
                          active ? TYPE_COLORS[type.value] : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        {type.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-3">
              <Button type="button" size="sm" onClick={() => void fetchTimeline(undefined, false)} disabled={loading}>
                اعمال فیلتر
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
                رویدادی برای نمایش وجود ندارد.
              </div>
            ) : (
              visibleItems.map((item) => {
                const recordingUrl =
                  typeof item.meta.recordingUrl === 'string' && item.meta.recordingUrl.trim().length > 0
                    ? item.meta.recordingUrl
                    : null;
                const quoteId = item.ref.quoteId;
                const taskId = item.ref.taskId;
                const taskDone = normalizeText(item.status) === 'done';

                return (
                  <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-xs ${TYPE_COLORS[item.type]}`}>
                            {typeLabel(item.type)}
                          </span>
                          <span className="text-xs text-slate-500">{formatJalali(item.ts)}</span>
                        </div>
                        <h3 className="mt-2 truncate text-sm font-semibold text-slate-900">{item.title}</h3>
                        <p className="mt-1 text-xs text-slate-600">{item.subtitle}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        {taskId && item.type === 'TASK' && !taskDone && canWriteTasks && (
                          <Button type="button" size="sm" variant="outline" onClick={() => void onMarkTaskDone(taskId)}>
                            انجام شد
                          </Button>
                        )}
                        {quoteId && item.type === 'QUOTE' && (
                          <Link
                            to={`${base}/quotes/${quoteId}`}
                            className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            باز کردن
                          </Link>
                        )}
                        {item.type === 'SMS' && (
                          <Button type="button" size="sm" variant="outline" onClick={() => void copySmsText(item)}>
                            کپی متن
                          </Button>
                        )}
                      </div>
                    </div>

                    {item.preview && <p className="mt-3 text-sm leading-6 text-slate-700">{item.preview}</p>}

                    {recordingUrl && item.type === 'CALL' && (
                      <div className="mt-3">
                        <audio controls preload="none" className="w-full" src={recordingUrl} />
                      </div>
                    )}
                  </article>
                );
              })
            )}

            {!loading && nextCursor && (
              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void fetchTimeline(nextCursor, true)}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'در حال بارگذاری...' : 'نمایش بیشتر'}
                </Button>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4 lg:col-span-4">
          <div className="sticky top-4 space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">خلاصه لید</h2>
              {leadData ? (
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p>
                    <span className="text-slate-500">نام:</span> {leadData.fullName}
                  </p>
                  <p>
                    <span className="text-slate-500">وضعیت:</span> {leadData.status}
                  </p>
                  <p>
                    <span className="text-slate-500">مسئول:</span> {leadData.ownerName ?? 'نامشخص'}
                  </p>
                  <p>
                    <span className="text-slate-500">پیگیری:</span>{' '}
                    {leadData.followUpAt ? formatJalali(leadData.followUpAt) : 'تنظیم نشده'}
                  </p>
                  <p>
                    <span className="text-slate-500">شرکت:</span> {leadData.companyName ?? '—'}
                  </p>
                </div>
              ) : (
                <Skeleton className="mt-3 h-24 w-full rounded-xl" />
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">شاخص سلامت</h2>
              <div className="mt-3 grid gap-2 text-sm">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                  <div className="text-xs text-slate-500">کارهای عقب‌افتاده</div>
                  <div className="mt-1 font-semibold text-slate-900">{formatFaNum(summary?.overdueTasks ?? 0)}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                  <div className="text-xs text-slate-500">پیش‌فاکتور منتظر پاسخ</div>
                  <div className="mt-1 font-semibold text-slate-900">{formatFaNum(summary?.waitingQuotes ?? 0)}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                  <div className="text-xs text-slate-500">آخرین تعامل</div>
                  <div className="mt-1 font-semibold text-slate-900">{daysSince(summary?.lastTouchAt ?? null)}</div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">اقدام سریع</h2>

              {quickError && (
                <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">
                  {quickError}
                </div>
              )}

              <div className="mt-3 space-y-4">
                <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <CheckCircle2 className="size-4" />
                    ایجاد کار
                  </div>
                  <Input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="عنوان کار" />
                  <JalaliDateInput value={taskDueAt} onChange={setTaskDueAt} />
                  <Button type="button" size="sm" onClick={() => void onCreateTask()} disabled={!canWriteTasks || quickBusy}>
                    <Plus className="ms-1 size-3.5" />
                    افزودن
                  </Button>
                </div>

                <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <MessageSquareText className="size-4" />
                    ارسال پیامک
                  </div>
                  <textarea
                    value={smsBody}
                    onChange={(event) => setSmsBody(event.target.value)}
                    rows={3}
                    placeholder="متن پیامک"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <Button type="button" size="sm" onClick={() => void onSendSms()} disabled={!canWriteSms || quickBusy || !leadData?.phone}>
                    ارسال
                  </Button>
                </div>

                <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <StickyNote className="size-4" />
                    افزودن یادداشت
                  </div>
                  <textarea
                    value={noteBody}
                    onChange={(event) => setNoteBody(event.target.value)}
                    rows={3}
                    placeholder="متن یادداشت"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <Button type="button" size="sm" onClick={() => void onAppendNote()} disabled={!canWriteLead || quickBusy}>
                    ثبت
                  </Button>
                </div>

                <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <FileText className="size-4" />
                    ایجاد پیش‌فاکتور
                  </div>
                  <Input value={quoteTitle} onChange={(event) => setQuoteTitle(event.target.value)} placeholder="عنوان پیش‌فاکتور" />
                  <Button type="button" size="sm" onClick={() => void onCreateQuote()} disabled={!canWriteQuote || quickBusy}>
                    ایجاد
                  </Button>
                </div>

                <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <PhoneCall className="size-4" />
                    ثبت تماس
                  </div>
                  <Link
                    to={`${base}/calls`}
                    className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    رفتن به مرکز تماس
                    <ChevronLeft className="ms-1 size-3.5" />
                  </Link>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">مسیر سریع</h2>
              <div className="mt-3 space-y-2">
                <Link to={`${base}/quotes`} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <Target className="size-4" />
                  لیست پیش‌فاکتورها
                </Link>
                <Link to={`${base}/tasks`} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <CalendarClock className="size-4" />
                  لیست کارها
                </Link>
                <Link to={`${base}/activity`} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <BellRing className="size-4" />
                  فعالیت‌ها
                </Link>
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
