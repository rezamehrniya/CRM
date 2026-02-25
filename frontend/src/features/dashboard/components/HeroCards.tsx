import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatFaCurrency, formatFaNum } from '@/lib/numbers';
import { BarChart3, CirclePercent, FileText, Info, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { ManagerOverviewResponse } from '../types';
import { AreaSparkline } from '../charts/AreaSparkline';
import { toFaStageLabel } from '../label-utils';

type Props = {
  hero: ManagerOverviewResponse['hero'];
};

type Pace = 'AHEAD' | 'ON_TRACK' | 'BEHIND';

function detectPace(progressPct: number): Pace {
  if (progressPct >= 100) return 'AHEAD';
  if (progressPct >= 70) return 'ON_TRACK';
  return 'BEHIND';
}

const paceMeta: Record<Pace, { label: string; barClass: string; pillClass: string }> = {
  AHEAD: {
    label: 'جلوتر از برنامه',
    barClass: 'bg-emerald-400',
    pillClass: 'bg-emerald-400/15 text-emerald-200',
  },
  ON_TRACK: {
    label: 'روی برنامه',
    barClass: 'bg-sky-400',
    pillClass: 'bg-sky-400/15 text-sky-200',
  },
  BEHIND: {
    label: 'عقب‌تر از برنامه',
    barClass: 'bg-amber-400',
    pillClass: 'bg-amber-400/15 text-amber-200',
  },
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2.5">
      <p className="text-[11px] text-white/80">{label}</p>
      <p className="fa-num mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function CurrencyValue({ value }: { value: number }) {
  return (
    <div className="flex items-end gap-1.5">
      <p className="fa-num text-3xl font-bold leading-none text-white">{formatFaCurrency(value, { showUnit: false })}</p>
      <span className="text-xs font-medium text-white/80">ریال</span>
    </div>
  );
}

function HeroCardShell({
  title,
  subtitle,
  icon,
  className,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn('overflow-hidden rounded-3xl border-0 text-white', className)}>
      <CardHeader className="space-y-2 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-sm text-white/95">{title}</CardTitle>
            <p className="text-[11px] text-white/75">{subtitle}</p>
          </div>
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-white/10 text-white">{icon}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">{children}</CardContent>
    </Card>
  );
}

export function HeroCards({ hero }: Props) {
  const revenueModeLabel = hero.revenue.mode === 'PROXY_QUOTE_SIGNED' ? 'قراردادهای امضاشده (نمایه)' : 'فروش واقعی (فاکتور)';
  const teamPace = detectPace(hero.teamTarget.progressPct);
  const teamPaceMeta = paceMeta[teamPace];
  const teamProgress = Math.max(0, Math.min(100, hero.teamTarget.progressPct));
  const quoteToInvoiceProgress = Math.max(0, Math.min(100, hero.pipeline.quoteToInvoiceRatePct));
  const conversionProgress = Math.max(0, Math.min(100, hero.funnel.totalConversionPct));
  const deltaPositive = hero.revenue.deltaPct >= 0;

  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-12">
      <HeroCardShell
        title="درآمد"
        subtitle="منبع: قیف • بازه: این ماه • معیار: مرحله «قرارداد امضا»"
        icon={<BarChart3 className="size-4" />}
        className="bg-gradient-to-br from-slate-900 via-blue-950 to-cyan-800 shadow-[0_18px_48px_-22px_rgba(8,47,73,0.95)] xl:col-span-4"
      >
        <div className="flex items-end justify-between gap-3">
          <CurrencyValue value={hero.revenue.current} />
          <div className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs">
            {deltaPositive ? <TrendingUp className="size-3.5 text-emerald-300" /> : <TrendingDown className="size-3.5 text-rose-300" />}
            <span className={cn('fa-num font-semibold', deltaPositive ? 'text-emerald-200' : 'text-rose-200')}>
              {formatFaNum(hero.revenue.deltaPct.toFixed(1))}%
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-white/85">
          <Info className="size-3.5 text-white/75" />
          <span>{revenueModeLabel}</span>
        </div>
        <AreaSparkline data={hero.revenue.sparkline} />
      </HeroCardShell>

      <HeroCardShell
        title="ارزش فرصت‌های باز"
        subtitle="منبع: پیش‌فاکتور • وضعیت: ارسال/مذاکره • مجموع ارزش"
        icon={<FileText className="size-4" />}
        className="bg-gradient-to-br from-slate-900 via-emerald-900 to-teal-700 shadow-[0_18px_48px_-22px_rgba(6,78,59,0.95)] xl:col-span-3"
      >
        <CurrencyValue value={hero.pipeline.openQuotesValue} />
        <Metric label="تعداد پیش‌فاکتور باز" value={formatFaNum(hero.pipeline.openQuotesCount)} />
        <div className="space-y-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5">
          <div className="flex items-center justify-between text-xs text-white/90">
            <span>تبدیل پیش‌فاکتور به فاکتور</span>
            <span className="fa-num font-semibold">{formatFaNum(hero.pipeline.quoteToInvoiceRatePct.toFixed(1))}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/20">
            <div className="h-2 rounded-full bg-sky-300 transition-all" style={{ width: `${quoteToInvoiceProgress}%` }} />
          </div>
        </div>
      </HeroCardShell>

      <HeroCardShell
        title="نرخ تبدیل قیف"
        subtitle="لید سرد ← قرارداد • بازه: ۳۰ روز • درصد تبدیل نهایی"
        icon={<CirclePercent className="size-4" />}
        className="bg-gradient-to-br from-slate-900 via-indigo-900 to-violet-700 shadow-[0_18px_48px_-22px_rgba(49,46,129,0.95)] xl:col-span-2"
      >
        <div className="flex items-end gap-1.5">
          <p className="fa-num text-3xl font-bold leading-none text-white">{formatFaNum(hero.funnel.totalConversionPct.toFixed(1))}</p>
          <span className="text-xs font-medium text-white/80">٪</span>
        </div>
        <div className="h-2 rounded-full bg-white/20">
          <div className="h-2 rounded-full bg-violet-300 transition-all" style={{ width: `${conversionProgress}%` }} />
        </div>
        <Metric label="مرحله گلوگاه" value={toFaStageLabel(hero.funnel.bottleneckStage)} />
      </HeroCardShell>

      <HeroCardShell
        title="پیشرفت تارگت تیم"
        subtitle="منبع: تارگت تیم • بازه: ماه جاری • نسبت تحقق"
        icon={<Target className="size-4" />}
        className="bg-gradient-to-br from-slate-900 via-amber-800 to-orange-700 shadow-[0_18px_48px_-22px_rgba(120,53,15,0.95)] xl:col-span-3"
      >
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-end gap-1.5">
            <p className="fa-num text-3xl font-bold leading-none text-white">{formatFaNum(hero.teamTarget.progressPct.toFixed(1))}</p>
            <span className="text-xs font-medium text-white/80">٪</span>
          </div>
          <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold', teamPaceMeta.pillClass)}>{teamPaceMeta.label}</span>
        </div>
        <div className="h-2 rounded-full bg-white/20">
          <div className={cn('h-2 rounded-full transition-all', teamPaceMeta.barClass)} style={{ width: `${teamProgress}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Metric label="محقق‌شده" value={formatFaCurrency(hero.teamTarget.achieved)} />
          <Metric label="هدف" value={formatFaCurrency(hero.teamTarget.target)} />
        </div>
      </HeroCardShell>
    </section>
  );
}
