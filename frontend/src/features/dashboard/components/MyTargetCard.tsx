import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatFaCurrency, formatFaNum } from '@/lib/numbers';
import { RepDashboardResponse } from '../types';

type Props = {
  target: RepDashboardResponse['myTarget'];
};

const paceTone: Record<RepDashboardResponse['myTarget']['pace'], string> = {
  AHEAD: 'bg-emerald-500/12 text-emerald-700',
  ON_TRACK: 'bg-sky-500/12 text-sky-700',
  BEHIND: 'bg-rose-500/12 text-rose-700',
};

const paceLabel: Record<RepDashboardResponse['myTarget']['pace'], string> = {
  AHEAD: 'جلوتر از برنامه',
  ON_TRACK: 'روی برنامه',
  BEHIND: 'عقب‌تر از برنامه',
};

export function MyTargetCard({ target }: Props) {
  const progressPct = target.target > 0 ? (target.achieved / target.target) * 100 : 0;
  const progressBarWidth = Math.max(0, Math.min(100, progressPct));
  const progressToneClass =
    target.pace === 'AHEAD' ? 'bg-emerald-500' : target.pace === 'ON_TRACK' ? 'bg-sky-500' : 'bg-rose-500';

  return (
    <Card className="rounded-3xl border-slate-200/70">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>تارگت من</CardTitle>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${paceTone[target.pace]}`}>
            {paceLabel[target.pace]}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">نمای نزدیک از عملکرد شخصی در برابر تارگت</p>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div>
          <p className="fa-num text-5xl font-black leading-none text-slate-900">{formatFaCurrency(target.achieved)}</p>
          <p className="mt-1 text-xs text-muted-foreground">مقدار محقق‌شده</p>
        </div>

        <div className="space-y-2">
          <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className={`h-3 rounded-full transition-all ${progressToneClass}`}
              style={{ width: `${progressBarWidth}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              هدف: <span className="fa-num font-semibold text-foreground">{formatFaCurrency(target.target)}</span>
            </span>
            <span>
              باقی‌مانده: <span className="fa-num font-semibold text-foreground">{formatFaCurrency(target.remaining)}</span>
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
          پیشرفت تا هدف: <span className="fa-num font-semibold text-foreground">{formatFaNum(progressPct.toFixed(1))}%</span>
        </div>
      </CardContent>
    </Card>
  );
}
