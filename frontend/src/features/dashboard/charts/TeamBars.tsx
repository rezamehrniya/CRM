import { AlertTriangle, Gauge, Goal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFaCurrency, formatFaNum } from '@/lib/numbers';
import { ManagerTeamResponse } from '../types';

type Props = {
  rows: ManagerTeamResponse['rows'];
};

type Pace = 'AHEAD' | 'ON_TRACK' | 'BEHIND';

const paceMeta: Record<Pace, { label: string; badgeClass: string }> = {
  AHEAD: {
    label: 'جلوتر از برنامه',
    badgeClass: 'bg-emerald-500/12 text-emerald-700',
  },
  ON_TRACK: {
    label: 'روی برنامه',
    badgeClass: 'bg-sky-500/12 text-sky-700',
  },
  BEHIND: {
    label: 'عقب‌تر از برنامه',
    badgeClass: 'bg-amber-500/12 text-amber-700',
  },
};

const sellerPalette = [
  {
    dot: 'bg-sky-500',
    barGradient: 'from-sky-600 via-sky-500 to-cyan-400',
    markerLine: 'bg-sky-600/90',
    markerChip: 'bg-sky-500/12 text-sky-700',
    progress: 'bg-sky-500',
    progressTrack: 'bg-sky-100',
  },
  {
    dot: 'bg-violet-500',
    barGradient: 'from-violet-600 via-violet-500 to-fuchsia-400',
    markerLine: 'bg-violet-600/90',
    markerChip: 'bg-violet-500/12 text-violet-700',
    progress: 'bg-violet-500',
    progressTrack: 'bg-violet-100',
  },
  {
    dot: 'bg-emerald-500',
    barGradient: 'from-emerald-600 via-emerald-500 to-teal-400',
    markerLine: 'bg-emerald-600/90',
    markerChip: 'bg-emerald-500/12 text-emerald-700',
    progress: 'bg-emerald-500',
    progressTrack: 'bg-emerald-100',
  },
  {
    dot: 'bg-amber-500',
    barGradient: 'from-amber-600 via-amber-500 to-orange-400',
    markerLine: 'bg-amber-600/90',
    markerChip: 'bg-amber-500/12 text-amber-700',
    progress: 'bg-amber-500',
    progressTrack: 'bg-amber-100',
  },
  {
    dot: 'bg-rose-500',
    barGradient: 'from-rose-600 via-rose-500 to-pink-400',
    markerLine: 'bg-rose-600/90',
    markerChip: 'bg-rose-500/12 text-rose-700',
    progress: 'bg-rose-500',
    progressTrack: 'bg-rose-100',
  },
  {
    dot: 'bg-indigo-500',
    barGradient: 'from-indigo-600 via-indigo-500 to-blue-400',
    markerLine: 'bg-indigo-600/90',
    markerChip: 'bg-indigo-500/12 text-indigo-700',
    progress: 'bg-indigo-500',
    progressTrack: 'bg-indigo-100',
  },
] as const;

function detectPace(progressPct: number): Pace {
  if (progressPct >= 100) return 'AHEAD';
  if (progressPct >= 70) return 'ON_TRACK';
  return 'BEHIND';
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getSellerTone(userId: string) {
  return sellerPalette[hashString(userId) % sellerPalette.length];
}

export function TeamBars({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        داده‌ای برای عملکرد تیم در بازه انتخابی وجود ندارد.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const pace = detectPace(row.progressPct);
        const paceInfo = paceMeta[pace];
        const sellerTone = getSellerTone(row.userId);

        // Per-seller axis so personal target marker is correct for that seller.
        const axisMaxValue = Math.max(row.revenue, row.personalTarget ?? 0, 1);
        const revenueRatio = clamp((row.revenue / axisMaxValue) * 100, 0, 100);
        const revenueWidth = row.revenue > 0 ? Math.max(12, revenueRatio) : 0;
        const targetRatio =
          row.personalTarget !== null && row.personalTarget > 0
            ? clamp((row.personalTarget / axisMaxValue) * 100, 0, 100)
            : null;
        const targetMarkerRight = targetRatio !== null ? clamp(targetRatio, 2, 98) : null;
        const targetProgressRatio =
          row.personalTarget !== null && row.personalTarget > 0
            ? clamp((row.revenue / row.personalTarget) * 100, 0, 100)
            : null;

        return (
          <article key={row.userId} className="rounded-2xl border border-border/70 bg-background/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="inline-flex max-w-full items-center gap-2 text-sm font-semibold">
                  <span className={cn('inline-block size-2 rounded-full', sellerTone.dot)} />
                  <span className="truncate">{row.name}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  درآمد: <span className="fa-num">{formatFaCurrency(row.revenue)}</span>
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${paceInfo.badgeClass}`}>
                {paceInfo.label}
              </span>
            </div>

            <div className="relative mt-3 overflow-hidden rounded-xl border border-border/70 bg-slate-100/60 dark:bg-slate-800/30">
              <div className="h-11 w-full" />
              <div
                className={cn(
                  'absolute inset-y-0 right-0 rounded-l-xl bg-gradient-to-l',
                  sellerTone.barGradient,
                )}
                style={{ width: `${revenueWidth}%` }}
              />
              {revenueWidth >= 24 && (
                <div
                  className="pointer-events-none absolute inset-y-0 right-0 flex items-center justify-between px-3 text-xs font-semibold text-white"
                  style={{ width: `${revenueWidth}%` }}
                >
                  <span className="inline-flex items-center gap-1">
                    <Gauge className="size-3.5" />
                    بسته‌شده
                  </span>
                  <span className="fa-num">{formatFaCurrency(row.revenue)}</span>
                </div>
              )}
              {targetMarkerRight !== null && (
                <>
                  <div
                    className="pointer-events-none absolute inset-y-0 z-10"
                    style={{ right: `calc(${targetMarkerRight}% - 1px)` }}
                  >
                    <div className={cn('h-full w-[2px]', sellerTone.markerLine)} />
                  </div>
                  <div
                    className={cn(
                      'pointer-events-none absolute -top-5 z-10 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      sellerTone.markerChip,
                    )}
                    style={{ right: `calc(${targetMarkerRight}% - 34px)` }}
                  >
                    هدف
                  </div>
                </>
              )}
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="fa-num">۰</span>
              <span className="fa-num">
                محور: {formatFaCurrency(axisMaxValue)}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-muted-foreground md:grid-cols-3">
              <span className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background/70 px-2 py-1">
                <Goal className="size-3.5 text-slate-500" />
                <span>
                  هدف:{' '}
                  <span className="fa-num font-semibold text-foreground">
                    {row.personalTarget !== null ? formatFaCurrency(row.personalTarget) : '—'}
                  </span>
                </span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background/70 px-2 py-1">
                <Gauge className="size-3.5 text-slate-500" />
                <span>
                  نرخ تبدیل:{' '}
                  <span className="fa-num font-semibold text-foreground">
                    {formatFaNum(row.conversionRatePct.toFixed(1))}%
                  </span>
                </span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background/70 px-2 py-1">
                <AlertTriangle className="size-3.5 text-amber-600" />
                <span>
                  معوق:{' '}
                  <span className="fa-num font-semibold text-foreground">{formatFaNum(row.overdueCount)}</span>
                </span>
              </span>
            </div>

            {targetProgressRatio !== null && (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>پیشرفت نسبت به هدف شخصی</span>
                  <span className="fa-num font-semibold text-foreground">
                    {formatFaNum(targetProgressRatio.toFixed(1))}%
                  </span>
                </div>
                <div className={cn('h-1.5 rounded-full', sellerTone.progressTrack)}>
                  <div
                    className={cn('h-1.5 rounded-full transition-all', sellerTone.progress)}
                    style={{ width: `${targetProgressRatio}%` }}
                  />
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
