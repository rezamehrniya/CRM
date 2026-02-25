import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatFaNum } from '@/lib/numbers';
import { RepDashboardResponse } from '../types';

type MySmsData = RepDashboardResponse['smsToday'];

type Props = {
  data?: MySmsData | null;
};

function percent(value: number): string {
  return `${formatFaNum(Math.round(value))}%`;
}

const EMPTY_MY_SMS: MySmsData = {
  sentToday: 0,
  deliveredToday: 0,
  failedToday: 0,
  deliveryRatePct: 0,
};

export function MySmsToday({ data }: Props) {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/t/${tenantSlug}/app`;
  const safeData = data ?? EMPTY_MY_SMS;

  return (
    <Card className="rounded-3xl border-slate-200/70">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div>
          <CardTitle>SMS من امروز</CardTitle>
          <p className="text-xs text-muted-foreground">نمای کلی ارسال پیامک شخصی</p>
        </div>
        <Button type="button" size="sm" onClick={() => navigate(`${base}/sms?compose=1`)}>
          ارسال سریع
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
          <p className="text-xs text-muted-foreground">ارسال</p>
          <p className="fa-num mt-1 text-lg font-bold">{formatFaNum(safeData.sentToday)}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
          <p className="text-xs text-muted-foreground">تحویل</p>
          <p className="fa-num mt-1 text-lg font-bold">{formatFaNum(safeData.deliveredToday)}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
          <p className="text-xs text-muted-foreground">ناموفق</p>
          <p className="fa-num mt-1 text-lg font-bold">{formatFaNum(safeData.failedToday)}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
          <p className="text-xs text-muted-foreground">نرخ تحویل</p>
          <p className="fa-num mt-1 text-lg font-bold">{percent(safeData.deliveryRatePct)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
