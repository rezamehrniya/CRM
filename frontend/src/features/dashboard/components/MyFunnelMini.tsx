import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatFaNum } from '@/lib/numbers';
import { RepDashboardResponse } from '../types';
import { toFaStageLabel } from '../label-utils';

type Props = {
  stages: RepDashboardResponse['myFunnel'];
};

function stagePastelClass(stageKey: string): string {
  switch (stageKey) {
    case 'COLD':
      return 'border-sky-700/80 bg-sky-900';
    case 'WARM':
      return 'border-amber-700/80 bg-amber-900';
    case 'QUALIFIED':
      return 'border-violet-700/80 bg-violet-900';
    case 'QUOTE_SENT':
      return 'border-cyan-700/80 bg-cyan-900';
    case 'NEGOTIATION':
      return 'border-rose-700/80 bg-rose-900';
    case 'SIGNED_CONTRACT':
      return 'border-emerald-700/80 bg-emerald-900';
    default:
      return 'border-slate-700/80 bg-slate-900';
  }
}

export function MyFunnelMini({ stages }: Props) {
  const maxCount = Math.max(...stages.map((stage) => stage.count), 1);
  const bottleneckStageKey = stages
    .slice(1)
    .reduce<{ key: string; conversion: number } | null>((min, stage, idx) => {
      const previous = stages[idx]?.count ?? 0;
      const conversion = previous > 0 ? (stage.count / previous) * 100 : 0;
      if (!min || conversion < min.conversion) {
        return { key: stage.stageKey, conversion };
      }
      return min;
    }, null)?.key;

  return (
    <Card className="rounded-3xl border-slate-200/70">
      <CardHeader className="space-y-2 pb-2">
        <CardTitle>خلاصه قیف من</CardTitle>
        <p className="text-xs text-muted-foreground">عرض هر مرحله براساس حجم آن است تا افت‌ها سریع دیده شوند</p>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {stages.map((stage, index) => {
          const previous = stages[index - 1]?.count ?? stage.count;
          const conversion = index === 0 ? 100 : previous > 0 ? (stage.count / previous) * 100 : 0;
          const widthPct = Math.max(42, Math.round((stage.count / maxCount) * 100));
          const isBottleneck = stage.stageKey === bottleneckStageKey;
          const stageLabel = toFaStageLabel(stage.stageLabel, stage.stageKey);

          return (
            <div key={stage.stageKey} className="flex justify-end">
              <div
                className={cn('rounded-2xl border p-3', stagePastelClass(stage.stageKey))}
                style={{ width: `${widthPct}%` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{stageLabel}</p>
                    <p className="mt-1 text-[11px] text-white/70">
                      {index === 0 ? 'مرحله مبنا' : `نرخ تبدیل از مرحله قبل: ${formatFaNum(conversion.toFixed(1))}%`}
                    </p>
                  </div>
                  <p className="fa-num text-lg font-bold text-white">{formatFaNum(stage.count)}</p>
                </div>

                <div className="mt-2">
                  {isBottleneck ? (
                    <span className="inline-flex rounded-full bg-rose-300/25 px-2 py-0.5 text-[11px] font-semibold text-white">
                      گلوگاه
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold text-white">
                      پایدار
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
