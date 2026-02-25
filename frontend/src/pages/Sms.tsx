import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageBreadcrumb } from '@/components/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { JalaliDateInput } from '@/components/ui/jalali-date-input';
import { useAuth } from '@/contexts/auth-context';
import {
  addSmsOptOut,
  createSmsTemplate,
  deleteSmsTemplate,
  getSmsLogs,
  getSmsOptOuts,
  getSmsTemplates,
  removeSmsOptOut,
  sendBulkSms,
  sendSingleSms,
  updateSmsTemplate,
} from '@/features/sms/api';
import { SmsListResponse, SmsStatus, SmsTemplateItem } from '@/features/sms/types';
import { formatFaNum } from '@/lib/numbers';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

type TabKey = 'send' | 'logs' | 'bulk' | 'settings';

const SMS_MODULE_UNAVAILABLE_MESSAGE =
  'ماژول پیامک روی سرور فعال نیست. لطفا بک‌اند را ری‌استارت کنید و مایگریشن‌ها را اجرا کنید.';

const STATUS_OPTIONS: Array<{ value: '' | SmsStatus; label: string }> = [
  { value: '', label: 'همه وضعیت‌ها' },
  { value: 'QUEUED', label: 'در صف' },
  { value: 'SENT', label: 'ارسال‌شده' },
  { value: 'DELIVERED', label: 'تحویل‌شده' },
  { value: 'FAILED', label: 'ناموفق' },
];

const STATUS_BADGE: Record<SmsStatus, string> = {
  QUEUED: 'bg-slate-500/10 text-slate-700 border-slate-300',
  SENT: 'bg-sky-500/10 text-sky-700 border-sky-300',
  DELIVERED: 'bg-emerald-500/10 text-emerald-700 border-emerald-300',
  FAILED: 'bg-rose-500/10 text-rose-700 border-rose-300',
};

const STATUS_LABEL: Record<SmsStatus, string> = {
  QUEUED: 'در صف',
  SENT: 'ارسال‌شده',
  DELIVERED: 'تحویل‌شده',
  FAILED: 'ناموفق',
};

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function percent(value: number): string {
  return `${formatFaNum(Math.round(value))}%`;
}

function formatDateTime(value: string | null): string {
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

function parseRecipients(raw: string): Array<{ phone: string; name?: string }> {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [phonePart, ...nameParts] = line.split(',');
      const phone = phonePart.trim();
      const name = nameParts.join(',').trim();
      return name ? { phone, name } : { phone };
    });
}

function isMissingSmsEndpoint(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('cannot get') && normalized.includes('/sms');
}

export default function SmsPage() {
  const { hasPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const canTeamScope = hasPermission('sms.team.read');
  const canBulkSend = hasPermission('sms.bulk.send');
  const canManage = hasPermission('sms.manage');

  const [tab, setTab] = useState<TabKey>(
    canBulkSend ? (searchParams.get('compose') ? 'send' : 'logs') : searchParams.get('compose') ? 'send' : 'logs',
  );

  const [scope, setScope] = useState<'me' | 'team'>(canTeamScope ? 'team' : 'me');
  const [status, setStatus] = useState<'' | SmsStatus>('');
  const [page, setPage] = useState(1);
  const [senderLine, setSenderLine] = useState('Sakhtar');

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  const [fromDate, setFromDate] = useState(toIsoDate(weekAgo));
  const [toDate, setToDate] = useState(toIsoDate(now));

  const [logsData, setLogsData] = useState<SmsListResponse | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);

  const [templates, setTemplates] = useState<SmsTemplateItem[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const [optOuts, setOptOuts] = useState<Array<{ id: string; phone: string; reason: string | null; createdAt: string }>>(
    [],
  );
  const [optOutsLoading, setOptOutsLoading] = useState(false);

  const [singlePhone, setSinglePhone] = useState('');
  const [singleName, setSingleName] = useState('');
  const [singleTemplateId, setSingleTemplateId] = useState('');
  const [singleBody, setSingleBody] = useState('');

  const [bulkTemplateId, setBulkTemplateId] = useState('');
  const [bulkBody, setBulkBody] = useState('');
  const [bulkCampaignName, setBulkCampaignName] = useState('');
  const [bulkRecipients, setBulkRecipients] = useState('');

  const [templateName, setTemplateName] = useState('');
  const [templateBody, setTemplateBody] = useState('');

  const [optOutPhone, setOptOutPhone] = useState('');
  const [optOutReason, setOptOutReason] = useState('');

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canTeamScope && scope === 'team') setScope('me');
  }, [canTeamScope, scope]);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await getSmsLogs({
        scope,
        from: fromDate,
        to: toDate,
        status: status || undefined,
        page,
        pageSize: 20,
      });
      setLogsData(data);
      setSenderLine(data.senderLine || 'Sakhtar');
      setError(null);
    } catch (err) {
      const text = err instanceof Error ? err.message : 'خطا در دریافت لاگ پیامک‌ها';
      if (isMissingSmsEndpoint(text)) {
        setLogsData({
          scope,
          senderLine: 'Sakhtar',
          page,
          pageSize: 20,
          total: 0,
          totalPages: 1,
          summary: {
            total: 0,
            queued: 0,
            sent: 0,
            delivered: 0,
            failed: 0,
            deliveryRatePct: 0,
            failureRatePct: 0,
          },
          items: [],
        });
        setSenderLine('Sakhtar');
        setError(SMS_MODULE_UNAVAILABLE_MESSAGE);
      } else {
        setError(text);
      }
    } finally {
      setLogsLoading(false);
    }
  }, [fromDate, page, scope, status, toDate]);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const data = await getSmsTemplates();
      setTemplates(data.items);
      if (data.senderLine) setSenderLine(data.senderLine);
    } catch (err) {
      const text = err instanceof Error ? err.message : 'خطا در دریافت قالب‌های پیامک';
      if (isMissingSmsEndpoint(text)) {
        setTemplates([]);
        setSenderLine('Sakhtar');
        setError(SMS_MODULE_UNAVAILABLE_MESSAGE);
      } else {
        setError(text);
      }
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const fetchOptOuts = useCallback(async () => {
    if (!canManage) return;
    setOptOutsLoading(true);
    try {
      const data = await getSmsOptOuts();
      setOptOuts(data.items);
    } catch (err) {
      const text = err instanceof Error ? err.message : 'خطا در دریافت لیست عدم دریافت';
      if (isMissingSmsEndpoint(text)) {
        setOptOuts([]);
        setError(SMS_MODULE_UNAVAILABLE_MESSAGE);
      } else {
        setError(text);
      }
    } finally {
      setOptOutsLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (tab === 'settings') void fetchOptOuts();
  }, [fetchOptOuts, tab]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) void fetchLogs();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [scope, status, fromDate, toDate]);

  const activeTemplates = useMemo(() => templates.filter((template) => template.isActive), [templates]);

  const switchTemplateIntoBody = (templateId: string, mode: 'single' | 'bulk') => {
    const template = activeTemplates.find((item) => item.id === templateId);
    if (!template) return;
    if (mode === 'single' && !singleBody.trim()) setSingleBody(template.body);
    if (mode === 'bulk' && !bulkBody.trim()) setBulkBody(template.body);
  };

  const handleSendSingle = async () => {
    if (!hasPermission('sms.write')) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await sendSingleSms({
        recipientPhone: singlePhone,
        recipientName: singleName || undefined,
        body: singleBody || undefined,
        templateId: singleTemplateId || undefined,
      });
      setMessage('پیامک با موفقیت در صف ارسال قرار گرفت.');
      setSinglePhone('');
      setSingleName('');
      setSingleBody('');
      setSingleTemplateId('');
      void fetchLogs();
    } catch (err) {
      const text = err instanceof Error ? err.message : 'ارسال پیامک ناموفق بود';
      setError(text);
    } finally {
      setBusy(false);
    }
  };

  const handleSendBulk = async () => {
    if (!canBulkSend) return;
    const recipients = parseRecipients(bulkRecipients);
    if (recipients.length === 0) {
      setError('حداقل یک گیرنده معتبر وارد کنید.');
      return;
    }

    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await sendBulkSms({
        recipients,
        body: bulkBody || undefined,
        templateId: bulkTemplateId || undefined,
        campaignName: bulkCampaignName || undefined,
      });
      setMessage(
        `ارسال گروهی ثبت شد: ${formatFaNum(response.created)} ارسالی، ${formatFaNum(response.skippedOptOut)} عدم دریافت، ${formatFaNum(response.skippedInvalid)} نامعتبر`,
      );
      setBulkRecipients('');
      setBulkCampaignName('');
      setBulkBody('');
      setBulkTemplateId('');
      void fetchLogs();
    } catch (err) {
      const text = err instanceof Error ? err.message : 'ارسال گروهی ناموفق بود';
      setError(text);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const created = await createSmsTemplate({
        name: templateName,
        body: templateBody,
        isActive: true,
      });
      setTemplates((prev) => [created, ...prev]);
      setTemplateName('');
      setTemplateBody('');
      setMessage('قالب پیامکی ایجاد شد.');
    } catch (err) {
      const text = err instanceof Error ? err.message : 'ایجاد قالب ناموفق بود';
      setError(text);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleTemplate = async (template: SmsTemplateItem) => {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await updateSmsTemplate(template.id, { isActive: !template.isActive });
      setTemplates((prev) => prev.map((item) => (item.id === template.id ? updated : item)));
    } catch (err) {
      const text = err instanceof Error ? err.message : 'بروزرسانی قالب ناموفق بود';
      setError(text);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTemplate = async (template: SmsTemplateItem) => {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    try {
      await deleteSmsTemplate(template.id);
      setTemplates((prev) => prev.filter((item) => item.id !== template.id));
    } catch (err) {
      const text = err instanceof Error ? err.message : 'حذف قالب ناموفق بود';
      setError(text);
    } finally {
      setBusy(false);
    }
  };

  const handleAddOptOut = async () => {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    try {
      const item = await addSmsOptOut({ phone: optOutPhone, reason: optOutReason || undefined });
      setOptOuts((prev) => [item, ...prev.filter((entry) => entry.phone !== item.phone)]);
      setOptOutPhone('');
      setOptOutReason('');
      setMessage('شماره در لیست عدم دریافت ثبت شد.');
    } catch (err) {
      const text = err instanceof Error ? err.message : 'ثبت عدم دریافت ناموفق بود';
      setError(text);
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveOptOut = async (phone: string) => {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    try {
      await removeSmsOptOut(phone);
      setOptOuts((prev) => prev.filter((entry) => entry.phone !== phone));
    } catch (err) {
      const text = err instanceof Error ? err.message : 'حذف عدم دریافت ناموفق بود';
      setError(text);
    } finally {
      setBusy(false);
    }
  };

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'send', label: 'ارسال تکی' },
    { key: 'logs', label: 'گزارش پیامک‌ها' },
    ...(canBulkSend ? ([{ key: 'bulk', label: 'ارسال گروهی' }] as Array<{ key: TabKey; label: string }>) : []),
    ...(canManage ? ([{ key: 'settings', label: 'قالب و Opt-out' }] as Array<{ key: TabKey; label: string }>) : []),
  ];

  return (
    <div className="space-y-6">
      <PageBreadcrumb current="پنل پیامک" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title-lg font-title">پنل پیامک</h1>
          <p className="text-sm text-muted-foreground">Sender ثابت: {senderLine}</p>
        </div>
        <div className="flex items-center gap-2">
          {canTeamScope && (
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-2">
              <button
                type="button"
                onClick={() => setScope('me')}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm transition-colors',
                  scope === 'me' ? 'bg-primary text-primary-foreground' : 'bg-[var(--bg-muted)] text-muted-foreground hover:text-foreground',
                )}
              >
                من
              </button>
              <button
                type="button"
                onClick={() => setScope('team')}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm transition-colors',
                  scope === 'team' ? 'bg-primary text-primary-foreground' : 'bg-[var(--bg-muted)] text-muted-foreground hover:text-foreground',
                )}
              >
                تیم
              </button>
            </div>
          )}
          <Button type="button" variant="outline" onClick={() => void fetchLogs()}>
            <RefreshCw className="size-4" />
            بروزرسانی
          </Button>
        </div>
      </div>

      {(message || error) && (
        <Card className={cn('rounded-2xl', error ? 'border-rose-300' : 'border-emerald-300')}>
          <CardContent className={cn('py-3 text-sm', error ? 'text-rose-600' : 'text-emerald-700')}>
            {error ?? message}
          </CardContent>
        </Card>
      )}

      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-2">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              'rounded-lg px-3 py-2 text-sm transition-colors',
              tab === item.key ? 'bg-primary text-primary-foreground' : 'bg-[var(--bg-muted)] text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'send' && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>ارسال پیامک تکی</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">گیرنده (موبایل)</label>
                <Input value={singlePhone} onChange={(event) => setSinglePhone(event.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">نام گیرنده (اختیاری)</label>
                <Input value={singleName} onChange={(event) => setSingleName(event.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">قالب</label>
                <select
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  value={singleTemplateId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSingleTemplateId(value);
                    if (value) switchTemplateIntoBody(value, 'single');
                  }}
                >
                  <option value="">بدون قالب</option>
                  {activeTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">متن پیامک</label>
              <textarea
                className="min-h-28 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                value={singleBody}
                onChange={(event) => setSingleBody(event.target.value)}
              />
            </div>
            <Button type="button" onClick={() => void handleSendSingle()} disabled={busy || !hasPermission('sms.write')}>
              ارسال پیامک
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === 'bulk' && canBulkSend && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>ارسال گروهی (فقط مدیر فروش)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">نام کمپین (اختیاری)</label>
                <Input value={bulkCampaignName} onChange={(event) => setBulkCampaignName(event.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">قالب</label>
                <select
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  value={bulkTemplateId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setBulkTemplateId(value);
                    if (value) switchTemplateIntoBody(value, 'bulk');
                  }}
                >
                  <option value="">بدون قالب</option>
                  {activeTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                گیرنده‌ها (هر خط: <code>phone,name</code> یا فقط <code>phone</code>)
              </label>
              <textarea
                className="min-h-40 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                value={bulkRecipients}
                onChange={(event) => setBulkRecipients(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">متن پیامک</label>
              <textarea
                className="min-h-28 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                value={bulkBody}
                onChange={(event) => setBulkBody(event.target.value)}
              />
            </div>
            <Button type="button" onClick={() => void handleSendBulk()} disabled={busy || !canBulkSend}>
              ثبت ارسال گروهی
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === 'logs' && (
        <div className="space-y-4">
          <Card className="rounded-3xl">
            <CardHeader className="pb-3">
              <CardTitle>فیلتر گزارش پیامک</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
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
                  onChange={(event) => setStatus(event.target.value as '' | SmsStatus)}
                >
                  {STATUS_OPTIONS.map((item) => (
                    <option key={item.label} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
                  <p className="text-xs text-muted-foreground">ارسال</p>
                  <p className="fa-num mt-1 text-lg font-bold">{formatFaNum(logsData?.summary.total ?? 0)}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
                  <p className="text-xs text-muted-foreground">نرخ تحویل</p>
                  <p className="fa-num mt-1 text-lg font-bold">{percent(logsData?.summary.deliveryRatePct ?? 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>لاگ پیامک‌ها</CardTitle>
            </CardHeader>
            <CardContent>
              {logsLoading && (logsData?.items.length ?? 0) === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">در حال دریافت...</div>
              ) : (logsData?.items.length ?? 0) === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">داده‌ای برای نمایش وجود ندارد.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px] text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="px-2 py-2 text-right">زمان صف</th>
                        <th className="px-2 py-2 text-right">گیرنده</th>
                        <th className="px-2 py-2 text-right">وضعیت</th>
                        <th className="px-2 py-2 text-right">ارسال‌کننده</th>
                        <th className="px-2 py-2 text-right">قالب/منبع</th>
                        <th className="px-2 py-2 text-right">متن</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logsData?.items.map((item) => (
                        <tr key={item.id} className="border-b border-border/60 align-top">
                          <td className="px-2 py-2 fa-num">{formatDateTime(item.queuedAt)}</td>
                          <td className="px-2 py-2">
                            <div className="fa-num">{item.recipientPhone}</div>
                            <div className="text-xs text-muted-foreground">{item.recipientName || '—'}</div>
                          </td>
                          <td className="px-2 py-2">
                            <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs', STATUS_BADGE[item.status])}>
                              {STATUS_LABEL[item.status]}
                            </span>
                            {item.errorMessage ? (
                              <div className="mt-1 text-xs text-rose-600">{item.errorMessage}</div>
                            ) : null}
                          </td>
                          <td className="px-2 py-2">{item.createdBy.name}</td>
                          <td className="px-2 py-2 text-xs text-muted-foreground">
                            <div>{item.template?.name ?? 'بدون قالب'}</div>
                            <div>{item.source}</div>
                          </td>
                          <td className="px-2 py-2">
                            <p className="max-w-[360px] truncate">{item.body}</p>
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
                  <Button type="button" variant="outline" size="sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                    قبلی
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage((prev) => Math.min(logsData?.totalPages ?? prev + 1, prev + 1))
                    }
                  >
                    بعدی
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'settings' && canManage && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>قالب‌های پیامک</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 rounded-xl border border-border p-3">
                <Input placeholder="نام قالب" value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
                <textarea
                  className="min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  placeholder="متن قالب"
                  value={templateBody}
                  onChange={(event) => setTemplateBody(event.target.value)}
                />
                <Button type="button" onClick={() => void handleCreateTemplate()} disabled={busy}>
                  افزودن قالب
                </Button>
              </div>

              {templatesLoading ? (
                <div className="py-4 text-center text-sm text-muted-foreground">در حال دریافت قالب‌ها...</div>
              ) : templates.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">قالبی ثبت نشده است.</div>
              ) : (
                <ul className="space-y-2">
                  {templates.map((template) => (
                    <li key={template.id} className="rounded-xl border border-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">{template.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{template.body}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => void handleToggleTemplate(template)} disabled={busy}>
                            {template.isActive ? 'غیرفعال' : 'فعال'}
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => void handleDeleteTemplate(template)} disabled={busy}>
                            حذف
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>لیست عدم دریافت (Opt-out)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 rounded-xl border border-border p-3">
                <Input placeholder="شماره موبایل" value={optOutPhone} onChange={(event) => setOptOutPhone(event.target.value)} />
                <Input placeholder="علت (اختیاری)" value={optOutReason} onChange={(event) => setOptOutReason(event.target.value)} />
                <Button type="button" onClick={() => void handleAddOptOut()} disabled={busy}>
                  افزودن به Opt-out
                </Button>
              </div>

              {optOutsLoading ? (
                <div className="py-4 text-center text-sm text-muted-foreground">در حال دریافت لیست...</div>
              ) : optOuts.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">شماره‌ای ثبت نشده است.</div>
              ) : (
                <ul className="space-y-2">
                  {optOuts.map((item) => (
                    <li key={item.id} className="rounded-xl border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="fa-num text-sm">{item.phone}</p>
                          <p className="text-xs text-muted-foreground">{item.reason || 'بدون توضیح'}</p>
                        </div>
                        <Button type="button" size="sm" variant="outline" onClick={() => void handleRemoveOptOut(item.phone)} disabled={busy}>
                          حذف
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
