import { formatFaCurrency, formatFaNum } from '@/lib/numbers';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Clock3, History } from 'lucide-react';

type Props = {
  loading: boolean;
  data: {
    widgets?: {
      topDealsAtRisk: Array<{
        dealId: string;
        title: string;
        amount: string;
        stageName: string;
        expectedCloseDate: string | null;
        ownerName: string;
        riskScore: number;
      }>;
      followUpsToday: Array<{
        leadId: string;
        name: string;
        phone: string;
        source: string | null;
        followUpAt: string | null;
        status: string;
        ownerName: string;
      }>;
      recentUpdates: Array<{
        type: 'LEAD' | 'ACTIVITY';
        id: string;
        title: string;
        at: string;
        actorName: string;
      }>;
    };
  } | null;
};

function Empty({ text }: { text: string }) {
  return (
    <div className="h-72 rounded-xl border border-dashed border-slate-300/70 dark:border-slate-700 grid place-items-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

const toFaDateTime = (dateLike: string | null | undefined) => {
  if (!dateLike) return '—';
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fa-IR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const leadStatusToFa = (status: string) => {
  const s = status.toUpperCase();
  if (s === 'NEW') return 'جدید';
  if (s === 'CONTACTED') return 'تماس گرفته شده';
  if (s === 'QUALIFIED') return 'واجد شرایط';
  if (s === 'CONVERTED') return 'تبدیل شده';
  if (s === 'LOST') return 'از دست رفته';
  return status;
};

function leadStatusClass(status: string) {
  const s = status.toUpperCase();
  if (s === 'NEW') return 'bg-blue-100 text-blue-700';
  if (s === 'CONTACTED') return 'bg-amber-100 text-amber-700';
  if (s === 'QUALIFIED') return 'bg-emerald-100 text-emerald-700';
  if (s === 'LOST') return 'bg-red-100 text-red-700';
  return 'bg-slate-100 text-slate-700';
}

function SectionTitle({
  title,
  icon: Icon,
}: {
  title: string;
  icon: typeof AlertTriangle;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="rounded-lg bg-white/80 p-1.5 text-slate-700 shadow-sm">
        <Icon className="size-4" />
      </span>
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
    </div>
  );
}

function updateTypeClass(type: 'LEAD' | 'ACTIVITY') {
  return type === 'LEAD'
    ? 'bg-purple-100 text-purple-700 border-purple-200'
    : 'bg-sky-100 text-sky-700 border-sky-200';
}

export function ManagerDashboardWidgets({ loading, data }: Props) {
  const topDealsAtRisk = data?.widgets?.topDealsAtRisk ?? [];
  const followUpsToday = data?.widgets?.followUpsToday ?? [];
  const recentUpdates = data?.widgets?.recentUpdates ?? [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
      <section className="rounded-2xl border border-red-200 bg-red-50/50 p-5 shadow-sm transition hover:shadow-md">
        <SectionTitle title="Top 10 معاملات در ریسک" icon={AlertTriangle} />
        {loading ? (
          <Skeleton className="h-72 w-full rounded-xl bg-white/10" />
        ) : topDealsAtRisk.length === 0 ? (
          <Empty text="معامله پرریسکی برای بازه جاری پیدا نشد" />
        ) : (
          <div className="max-h-[420px] space-y-3 overflow-auto pe-1">
            {topDealsAtRisk.map((deal) => {
              const riskTone =
                deal.riskScore >= 70
                  ? 'bg-red-500/15 text-red-600 dark:text-red-300'
                  : deal.riskScore >= 45
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                    : 'bg-sky-500/15 text-sky-600 dark:text-sky-300';
              return (
                <div key={deal.dealId} className="rounded-xl border border-border/60 bg-background/40 p-3">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div className="text-sm font-medium">{deal.title}</div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${riskTone}`}>
                      ریسک {formatFaNum(deal.riskScore)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>مالک: {deal.ownerName}</div>
                    <div>مرحله: {deal.stageName}</div>
                    <div className="fa-num">ارزش: {formatFaCurrency(deal.amount)}</div>
                    <div>موعد بستن: {toFaDateTime(deal.expectedCloseDate)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm transition hover:shadow-md">
        <SectionTitle title="پیگیری‌های امروز" icon={Clock3} />
        {loading ? (
          <Skeleton className="h-72 w-full rounded-xl bg-white/10" />
        ) : followUpsToday.length === 0 ? (
          <Empty text="پیگیری ضروری برای امروز وجود ندارد" />
        ) : (
          <div className="max-h-[420px] space-y-3 overflow-auto pe-1">
            {followUpsToday.map((lead) => (
              <div key={lead.leadId} className="rounded-xl border border-border/60 bg-background/40 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{lead.name}</div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${leadStatusClass(lead.status)}`}>
                    {leadStatusToFa(lead.status)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="fa-num">{lead.phone}</div>
                  <div>منبع: {lead.source ?? 'نامشخص'}</div>
                  <div>مالک: {lead.ownerName}</div>
                  <div>موعد: {toFaDateTime(lead.followUpAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
        <SectionTitle title="آخرین تغییرات" icon={History} />
        {loading ? (
          <Skeleton className="h-72 w-full rounded-xl bg-white/10" />
        ) : recentUpdates.length === 0 ? (
          <Empty text="تغییری برای نمایش وجود ندارد" />
        ) : (
          <div className="max-h-[420px] space-y-3 overflow-auto pe-1">
            {recentUpdates.map((item) => (
              <div key={`${item.type}-${item.id}`} className="rounded-xl border border-border/60 bg-background/40 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${updateTypeClass(item.type)}`}>
                    {item.type === 'LEAD' ? 'لید' : 'فعالیت'}
                  </span>
                  <span className="text-xs text-muted-foreground">{toFaDateTime(item.at)}</span>
                </div>
                <div className="text-sm font-medium">{item.title}</div>
                <div className="text-xs text-muted-foreground mt-1">توسط: {item.actorName}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
