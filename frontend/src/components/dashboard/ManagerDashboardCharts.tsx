import { formatFaCurrency, formatFaNum } from '@/lib/numbers';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, LineChart, PieChart as PieChartIcon, ActivitySquare, Gauge, UsersRound } from 'lucide-react';

type Props = {
  loading: boolean;
  data: {
    pipelineByStage?: Array<{ stageId: string; stageName: string; dealsCount: number; pipelineValue: string }>;
    pipelineTrend?: Array<{ date: string; value: number }>;
    wonLostTrend?: Array<{ date: string; won: number; lost: number }>;
    leadSourcePerformance?: Array<{
      source: string;
      leadsCount: number;
      dealsCreated: number;
      conversionRatePct: number;
      convertedCount: number;
      lostCount: number;
    }>;
    activitiesMix?: Array<{ type: string; count: number }>;
    tasksHealth?: { open: number; done: number; overdue: number };
    repPerformance?: Array<{
      userId: string;
      name: string;
      role: string;
      leadsAssigned: number;
      dealsOpen: number;
      won: number;
      winRatePct: number;
      activities: number;
      overdueTasks: number;
    }>;
  } | null;
};

const PIE_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#a855f7', '#ef4444', '#0ea5e9'];
const TOOLTIP_STYLE = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 12,
  color: 'hsl(var(--popover-foreground))',
};
const TOOLTIP_TEXT_STYLE = { color: 'hsl(var(--popover-foreground))' };

function Empty({ text, h }: { text: string; h: string }) {
  return <div className={`${h} rounded-xl border border-dashed border-slate-300/70 dark:border-slate-700 grid place-items-center text-sm text-muted-foreground`}>{text}</div>;
}

function SectionTitle({
  title,
  icon: Icon,
}: {
  title: string;
  icon: typeof BarChart3;
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

const toFaDate = (dateLike: string) => {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return dateLike;
  return date.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
};

const typeToFa = (type: string) => {
  const t = type.toUpperCase();
  if (t === 'CALL') return 'تماس';
  if (t === 'MEETING') return 'جلسه';
  if (t === 'NOTE') return 'یادداشت';
  return type;
};

const toRial = (value: number | string | null | undefined) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 10);
};

export function ManagerDashboardCharts({ loading, data }: Props) {
  const pipelineByStage = (data?.pipelineByStage ?? []).map((x) => ({ ...x, pipelineValueNum: Number(x.pipelineValue || 0) }));
  const pipelineTrend = (data?.pipelineTrend ?? []).map((x) => ({ ...x, label: toFaDate(x.date) }));
  const wonLost = (data?.wonLostTrend ?? []).map((x) => ({ ...x, label: toFaDate(x.date) }));
  const sources = (data?.leadSourcePerformance ?? []).slice(0, 7);
  const activities = data?.activitiesMix ?? [];
  const tasks = [
    { label: 'باز', value: data?.tasksHealth?.open ?? 0, color: '#2563eb' },
    { label: 'انجام شده', value: data?.tasksHealth?.done ?? 0, color: '#16a34a' },
    { label: 'معوق', value: data?.tasksHealth?.overdue ?? 0, color: '#ef4444' },
  ];
  const reps = data?.repPerformance ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5 shadow-sm transition hover:shadow-md">
          <SectionTitle title="توزیع مراحل پایپلاین" icon={BarChart3} />
          {loading ? <Skeleton className="h-72 w-full rounded-xl bg-white/10" /> : pipelineByStage.length === 0 ? <Empty text="داده‌ای برای نمایش وجود ندارد" h="h-72" /> : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
                <BarChart data={pipelineByStage}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#64748b" opacity={0.25} />
                  <XAxis dataKey="stageName" tick={{ fill: '#475569', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#475569', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_TEXT_STYLE}
                    itemStyle={TOOLTIP_TEXT_STYLE}
                    formatter={(v: number | string | undefined) => [formatFaNum(Number(v)), 'تعداد']}
                  />
                  <Bar dataKey="dealsCount" name="تعداد معامله" fill="#2563eb" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm transition hover:shadow-md">
          <SectionTitle title="روند ارزش پایپلاین" icon={LineChart} />
          {loading ? <Skeleton className="h-72 w-full rounded-xl bg-white/10" /> : pipelineTrend.length === 0 ? <Empty text="روندی برای نمایش وجود ندارد" h="h-72" /> : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
                <AreaChart data={pipelineTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#64748b" opacity={0.25} />
                  <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#475569', fontSize: 11 }} tickFormatter={(v) => formatFaNum(toRial(v))} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_TEXT_STYLE}
                    itemStyle={TOOLTIP_TEXT_STYLE}
                    formatter={(v: number | string | undefined) => [
                      formatFaCurrency(Number(v ?? 0), { sourceUnit: 'TOMAN', outputUnit: 'RIAL' }),
                      'ارزش',
                    ]}
                  />
                  <Area type="monotone" dataKey="value" stroke="#0ea5e9" fill="#38bdf8" fillOpacity={0.25} strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm transition hover:shadow-md">
          <SectionTitle title="برد/باخت در زمان" icon={Gauge} />
          {loading ? <Skeleton className="h-64 w-full rounded-xl bg-white/10" /> : wonLost.length === 0 ? <Empty text="داده‌ای برای برد/باخت وجود ندارد" h="h-64" /> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
                <BarChart data={wonLost}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#64748b" opacity={0.25} />
                  <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#475569', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_TEXT_STYLE}
                    itemStyle={TOOLTIP_TEXT_STYLE}
                    formatter={(v: number | string | undefined) => [formatFaNum(Number(v)), 'تعداد']}
                  />
                  <Legend />
                  <Bar dataKey="won" name="برد" fill="#16a34a" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="lost" name="باخت" fill="#ef4444" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-purple-200 bg-purple-50/60 p-5 shadow-sm transition hover:shadow-md">
          <SectionTitle title="عملکرد منابع لید" icon={UsersRound} />
          {loading ? <Skeleton className="h-64 w-full rounded-xl bg-white/10" /> : sources.length === 0 ? <Empty text="منبع لیدی ثبت نشده" h="h-64" /> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
                <BarChart data={sources} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#64748b" opacity={0.25} />
                  <XAxis type="number" tick={{ fill: '#475569', fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="source" width={90} tick={{ fill: '#475569', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_TEXT_STYLE}
                    itemStyle={TOOLTIP_TEXT_STYLE}
                    formatter={(v: number | string | undefined) => [formatFaNum(Number(v)), 'تعداد لید']}
                  />
                  <Bar dataKey="leadsCount" name="تعداد لید" radius={[0, 8, 8, 0]}>
                    {sources.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        <section className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-5 shadow-sm transition hover:shadow-md">
          <SectionTitle title="ترکیب فعالیت‌ها" icon={PieChartIcon} />
          {loading ? <Skeleton className="h-64 w-full rounded-xl bg-white/10" /> : activities.length === 0 ? <Empty text="فعالیتی برای نمایش وجود ندارد" h="h-64" /> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
                <PieChart>
                  <Pie data={activities.map((i) => ({ ...i, label: typeToFa(i.type) }))} dataKey="count" nameKey="label" innerRadius={56} outerRadius={90}>
                    {activities.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_TEXT_STYLE}
                    itemStyle={TOOLTIP_TEXT_STYLE}
                    formatter={(v: number | string | undefined) => [formatFaNum(Number(v)), 'تعداد']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5 shadow-sm transition hover:shadow-md">
          <SectionTitle title="سلامت کارها" icon={ActivitySquare} />
          {loading ? <Skeleton className="h-64 w-full rounded-xl bg-white/10" /> : tasks.every((x) => x.value === 0) ? <Empty text="کاری برای نمایش وجود ندارد" h="h-64" /> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
                <BarChart data={tasks}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#64748b" opacity={0.25} />
                  <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#475569', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_TEXT_STYLE}
                    itemStyle={TOOLTIP_TEXT_STYLE}
                    formatter={(v: number | string | undefined) => [formatFaNum(Number(v)), 'تعداد']}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {tasks.map((x) => <Cell key={x.label} fill={x.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
        <SectionTitle title="عملکرد فروشنده‌ها" icon={UsersRound} />
        {loading ? <Skeleton className="h-64 w-full rounded-xl bg-white/10" /> : reps.length === 0 ? <Empty text="داده‌ای برای عملکرد فروشنده‌ها موجود نیست" h="h-64" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border/70">
                  <th className="px-2 py-2 text-right">فروشنده</th><th className="px-2 py-2 text-right">لید</th><th className="px-2 py-2 text-right">معامله باز</th><th className="px-2 py-2 text-right">برد</th><th className="px-2 py-2 text-right">WinRate</th><th className="px-2 py-2 text-right">فعالیت</th><th className="px-2 py-2 text-right">معوق</th>
                </tr>
              </thead>
              <tbody>
                {reps.map((rep, idx) => (
                  <tr key={rep.userId} className={`border-b border-border/50 ${idx % 2 === 0 ? 'bg-slate-50/60' : 'bg-white'}`}>
                    <td className="px-2 py-2">{rep.name}</td><td className="px-2 py-2 fa-num">{formatFaNum(rep.leadsAssigned)}</td><td className="px-2 py-2 fa-num">{formatFaNum(rep.dealsOpen)}</td><td className="px-2 py-2 fa-num">{formatFaNum(rep.won)}</td><td className="px-2 py-2">{formatFaNum(rep.winRatePct.toFixed(1))}٪</td><td className="px-2 py-2 fa-num">{formatFaNum(rep.activities)}</td><td className="px-2 py-2 fa-num">{formatFaNum(rep.overdueTasks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
