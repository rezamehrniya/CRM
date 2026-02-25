import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatFaCurrency, formatFaNum } from '@/lib/numbers';
import { ManagerOverviewResponse } from '../types';
import { toFaStageLabel } from '../label-utils';

type Props = {
  stages: ManagerOverviewResponse['funnelStages'];
  onStageClick?: (stageKey: string) => void;
};

function stagePastelClass(stageKey: string): string {
  switch (stageKey) {
    case 'COLD':
      return 'border-sky-700/80 bg-sky-900 hover:bg-sky-800/90';
    case 'WARM':
      return 'border-amber-700/80 bg-amber-900 hover:bg-amber-800/90';
    case 'QUALIFIED':
      return 'border-violet-700/80 bg-violet-900 hover:bg-violet-800/90';
    case 'QUOTE_SENT':
      return 'border-cyan-700/80 bg-cyan-900 hover:bg-cyan-800/90';
    case 'NEGOTIATION':
      return 'border-rose-700/80 bg-rose-900 hover:bg-rose-800/90';
    case 'SIGNED_CONTRACT':
      return 'border-emerald-700/80 bg-emerald-900 hover:bg-emerald-800/90';
    default:
      return 'border-slate-700/80 bg-slate-900 hover:bg-slate-800/90';
  }
}

export function FunnelBigPicture({ stages, onStageClick }: Props) {
  const maxCount = Math.max(...stages.map((stage) => stage.count), 1);
  const bottleneckStageKey = stages
    .slice(1)
    .reduce<{ key: string; conversion: number } | null>((min, stage) => {
      if (!min || stage.conversionFromPrevPct < min.conversion) {
        return { key: stage.stageKey, conversion: stage.conversionFromPrevPct };
      }
      return min;
    }, null)?.key;

  return (
    <Card className="rounded-3xl border-slate-200/70">
      <CardHeader className="space-y-2 pb-1">
        <CardTitle>نمای کلی قیف فروش</CardTitle>
        <p className="text-xs text-muted-foreground">عرض هر مرحله بر اساس حجم آن وزن‌دهی شده است.</p>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        {stages.map((stage, index) => {
          const widthPct = Math.max(42, Math.round((stage.count / maxCount) * 100));
          const stageLabel = toFaStageLabel(stage.stageLabel, stage.stageKey);
          const previous = stages[index - 1];
          const previousLabel = previous ? toFaStageLabel(previous.stageLabel, previous.stageKey) : null;
          const conversionText = previousLabel
            ? `نرخ تبدیل از ${previousLabel}: ${formatFaNum(stage.conversionFromPrevPct.toFixed(1))}%`
            : 'مرحله مبنا';
          const isBottleneck = stage.stageKey === bottleneckStageKey;

          return (
            <div key={stage.stageKey} className="flex justify-end">
              <button
                type="button"
                onClick={() => onStageClick?.(stage.stageKey)}
                style={{ width: `${widthPct}%` }}
                className={cn(
                  'rounded-2xl border p-3 text-right transition',
                  stagePastelClass(stage.stageKey),
                )}
                >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">{stageLabel}</p>
                    <p className="mt-1 text-[11px] text-white/70">{conversionText}</p>
                  </div>
                  <p className="fa-num text-lg font-bold text-white">{formatFaNum(stage.count)}</p>
                </div>
                <div className="grid grid-cols-1 gap-2 text-xs text-white/80 sm:grid-cols-3">
                  <span>ارزش: {formatFaCurrency(stage.budgetSum)}</span>
                  <span>میانگین روز: {formatFaNum(stage.avgDaysInStage.toFixed(1))}</span>
                  {isBottleneck ? (
                    <span className="inline-flex w-fit items-center rounded-full bg-rose-300/25 px-2 py-0.5 text-white">
                      گلوگاه
                    </span>
                  ) : (
                    <span className="inline-flex w-fit items-center rounded-full bg-white/20 px-2 py-0.5 text-white">
                      پایدار
                    </span>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
