import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatFaCurrency, formatFaNum } from '@/lib/numbers';
import { ManagerOverviewResponse } from '../types';

type Props = {
  kpis: ManagerOverviewResponse['kpis'];
};

const LABELS: Array<{ key: keyof ManagerOverviewResponse['kpis']; label: string }> = [
  { key: 'leadsToday', label: 'لیدهای امروز' },
  { key: 'overdueFollowUps', label: 'پیگیری‌های معوق' },
  { key: 'avgResponseHours', label: 'میانگین پاسخ (ساعت)' },
  { key: 'quotesPendingApproval', label: 'پیش‌فاکتورهای در انتظار تایید' },
  { key: 'signedContractsThisMonth', label: 'قراردادهای امضاشده این ماه' },
  { key: 'avgRevenueUnitValue', label: 'میانگین ارزش هر فروش' },
];

export function KPIGrid({ kpis }: Props) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
      {LABELS.map((item) => {
        const value = kpis[item.key];
        const text =
          value === null
            ? 'نامشخص'
            : item.key === 'avgRevenueUnitValue'
              ? formatFaCurrency(typeof value === 'number' ? value : 0)
              : formatFaNum(typeof value === 'number' ? value : 0);
        return (
          <Card key={item.key} className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground">{item.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="fa-num text-2xl font-semibold">{text}</p>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
