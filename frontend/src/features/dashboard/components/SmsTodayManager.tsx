import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatFaNum } from '@/lib/numbers';
import { ManagerOverviewResponse } from '../types';

type SmsTodayData = ManagerOverviewResponse['smsToday'];

type Props = {
  data?: SmsTodayData | null;
};

function rate(value: number): string {
  return `${formatFaNum(Math.round(value))}%`;
}

const EMPTY_SMS_TODAY: SmsTodayData = {
  sentToday: 0,
  deliveredToday: 0,
  failedToday: 0,
  deliveryRatePct: 0,
  reps: [],
};

function toSafeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function SmsTodayManager({ data }: Props) {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/t/${tenantSlug}/app`;
  const safeData: SmsTodayData = {
    sentToday: toSafeNumber(data?.sentToday ?? EMPTY_SMS_TODAY.sentToday),
    deliveredToday: toSafeNumber(data?.deliveredToday ?? EMPTY_SMS_TODAY.deliveredToday),
    failedToday: toSafeNumber(data?.failedToday ?? EMPTY_SMS_TODAY.failedToday),
    deliveryRatePct: toSafeNumber(data?.deliveryRatePct ?? EMPTY_SMS_TODAY.deliveryRatePct),
    reps: Array.isArray(data?.reps)
      ? data.reps.map((rep) => ({
          userId: rep.userId,
          name: rep.name ?? 'نامشخص',
          sentToday: toSafeNumber(rep.sentToday),
          deliveredToday: toSafeNumber(rep.deliveredToday),
          failedToday: toSafeNumber(rep.failedToday),
        }))
      : [],
  };
  const maxSent = Math.max(1, ...safeData.reps.map((rep) => toSafeNumber(rep.sentToday)));

  return (
    <Card className="rounded-3xl border-slate-200/70">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div>
          <CardTitle>SMS امروز</CardTitle>
          <p className="text-xs text-muted-foreground">ارسال، نرخ تحویل و خطاهای پیامکی تیم</p>
        </div>
        <Button type="button" size="sm" onClick={() => navigate(`${base}/sms`)}>
          مرکز SMS
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
            <p className="text-xs text-muted-foreground">ارسال امروز</p>
            <p className="fa-num mt-1 text-xl font-bold">{formatFaNum(safeData.sentToday)}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
            <p className="text-xs text-muted-foreground">نرخ تحویل</p>
            <p className="fa-num mt-1 text-xl font-bold">{rate(safeData.deliveryRatePct)}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
            <p className="text-xs text-muted-foreground">ناموفق</p>
            <p className="fa-num mt-1 text-xl font-bold">{formatFaNum(safeData.failedToday)}</p>
          </div>
        </div>

        <div className="space-y-2">
          {safeData.reps.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
              داده‌ای برای تیم ثبت نشده است.
            </div>
          ) : (
            safeData.reps.map((rep) => {
              const width = `${Math.max(6, Math.round((rep.sentToday / maxSent) * 100))}%`;
              return (
                <div key={rep.userId} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-foreground">{rep.name}</span>
                    <span className="fa-num text-muted-foreground">
                      {formatFaNum(rep.sentToday)} | تحویل {formatFaNum(rep.deliveredToday)} | خطا {formatFaNum(rep.failedToday)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200/80">
                    <div className="h-full rounded-full bg-sky-500/80" style={{ width }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
