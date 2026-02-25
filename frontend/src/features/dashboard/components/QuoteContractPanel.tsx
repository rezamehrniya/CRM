import { Button } from '@/components/ui/button';
import { formatFaCurrency, formatFaNum } from '@/lib/numbers';
import { toFaStageLabel } from '../label-utils';
import { QuoteDonut } from '../charts/QuoteDonut';
import { ManagerOverviewResponse } from '../types';

type Props = {
  overview: Pick<
    ManagerOverviewResponse,
    'hero' | 'kpis' | 'funnelStages' | 'quoteStatus' | 'actionCenter' | 'quoteContract'
  >;
  onOpenQuotes: () => void;
  onOpenStage?: (stageKey: string) => void;
};

const FLOW_STAGE_ORDER = [
  'COLD',
  'WARM',
  'QUALIFIED',
  'QUOTE_SENT',
  'NEGOTIATION',
  'SIGNED_CONTRACT',
] as const;

const FLOW_STAGE_TONE: Record<string, string> = {
  COLD: 'border-sky-700/80 bg-sky-900',
  WARM: 'border-amber-700/80 bg-amber-900',
  QUALIFIED: 'border-violet-700/80 bg-violet-900',
  QUOTE_SENT: 'border-cyan-700/80 bg-cyan-900',
  NEGOTIATION: 'border-rose-700/80 bg-rose-900',
  SIGNED_CONTRACT: 'border-emerald-700/80 bg-emerald-900',
};

export function QuoteContractPanel({ overview, onOpenQuotes, onOpenStage }: Props) {
  const safeQuoteContract = overview.quoteContract ?? {
    thisMonth: {
      count: 0,
      amountSum: 0,
      avgAmount: 0,
      avgDaysFromQuoteSent: null,
    },
    latestSigned: [],
  };
  const hasQuoteData = overview.quoteStatus.some((item) => item.count > 0);
  const flowRows = FLOW_STAGE_ORDER.map((key) =>
    overview.funnelStages.find((stage) => stage.stageKey === key),
  ).filter((item): item is NonNullable<typeof item> => Boolean(item));

  const contractsLatest =
    safeQuoteContract.latestSigned.length > 0
      ? safeQuoteContract.latestSigned.slice(0, 5)
      : overview.actionCenter.contractsThisWeek.slice(0, 5).map((item) => ({
          ...item,
          owner: 'نامشخص',
        }));
  const avgAmount = safeQuoteContract.thisMonth.avgAmount || overview.kpis.avgRevenueUnitValue || 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
          <p className="text-xs text-muted-foreground">قرارداد این ماه</p>
          <p className="fa-num mt-1 text-lg font-bold">{formatFaNum(safeQuoteContract.thisMonth.count)}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
          <p className="text-xs text-muted-foreground">مجموع مبلغ</p>
          <p className="fa-num mt-1 text-lg font-bold">{formatFaCurrency(safeQuoteContract.thisMonth.amountSum)}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
          <p className="text-xs text-muted-foreground">میانگین مبلغ قرارداد</p>
          <p className="fa-num mt-1 text-lg font-bold">{formatFaCurrency(avgAmount)}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
          <p className="text-xs text-muted-foreground">میانگین زمان تبدیل</p>
          <p className="fa-num mt-1 text-lg font-bold">
            {safeQuoteContract.thisMonth.avgDaysFromQuoteSent === null
              ? '—'
              : `${formatFaNum(safeQuoteContract.thisMonth.avgDaysFromQuoteSent.toFixed(1))} روز`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
          {hasQuoteData ? (
            <QuoteDonut data={overview.quoteStatus} />
          ) : (
            <div className="flex h-80 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border text-center">
              <p className="text-sm text-muted-foreground">در این بازه داده‌ای برای جریان پیش‌فاکتور ثبت نشده است.</p>
              <Button type="button" size="sm" onClick={onOpenQuotes}>
                رفتن به پیش‌فاکتورها
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {flowRows.map((stage, index) => {
            const stageLabel = toFaStageLabel(stage.stageLabel, stage.stageKey);
            const prevLabel =
              index > 0
                ? toFaStageLabel(flowRows[index - 1].stageLabel, flowRows[index - 1].stageKey)
                : null;
            const toneClass = FLOW_STAGE_TONE[stage.stageKey] ?? 'border-slate-700/80 bg-slate-900';
            const conversionText =
              index === 0
                ? 'مرحله مبنا'
                : `نرخ تبدیل از ${prevLabel}: ${formatFaNum(stage.conversionFromPrevPct.toFixed(1))}%`;

            return (
              <button
                key={stage.stageKey}
                type="button"
                onClick={() => onOpenStage?.(stage.stageKey)}
                className={`w-full rounded-xl border px-3 py-2 text-right transition hover:opacity-90 ${toneClass}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{stageLabel}</p>
                    <p className="mt-1 text-[11px] text-white/70">{conversionText}</p>
                  </div>
                  <p className="fa-num text-base font-bold text-white">{formatFaNum(stage.count)}</p>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-white/80">
                  <span>ارزش: {formatFaCurrency(stage.budgetSum)}</span>
                  <span>میانگین روز: {formatFaNum(stage.avgDaysInStage.toFixed(1))}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">آخرین قراردادهای امضا شده</h4>
          <Button type="button" size="sm" variant="outline" onClick={onOpenQuotes}>
            مشاهده همه
          </Button>
        </div>
        {contractsLatest.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
            در این بازه قرارداد امضا شده‌ای ثبت نشده است.
          </div>
        ) : (
          <div className="space-y-2">
            {contractsLatest.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{item.company}</p>
                  <p className="text-muted-foreground">
                    {new Date(item.signedAt).toLocaleDateString('fa-IR')}
                    {' · '}
                    {item.owner}
                  </p>
                </div>
                <p className="fa-num font-semibold text-foreground">{formatFaCurrency(item.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
