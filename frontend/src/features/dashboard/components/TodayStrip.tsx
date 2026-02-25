import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, FileClock, ListTodo, PhoneCall } from 'lucide-react';
import { formatFaNum } from '@/lib/numbers';
import { RepDashboardResponse } from '../types';

type Props = {
  today: RepDashboardResponse['today'];
};

const ITEMS: Array<{
  key: keyof RepDashboardResponse['today'];
  label: string;
  subtitle: string;
  icon: typeof ListTodo;
  iconClass: string;
}> = [
  {
    key: 'tasksToday',
    label: 'کارهای امروز',
    subtitle: 'پیگیری‌های برنامه‌ریزی‌شده',
    icon: ListTodo,
    iconClass: 'bg-sky-500/12 text-sky-700',
  },
  {
    key: 'overdue',
    label: 'معوق',
    subtitle: 'نیازمند اقدام فوری',
    icon: AlertTriangle,
    iconClass: 'bg-rose-500/12 text-rose-700',
  },
  {
    key: 'callsToday',
    label: 'تماس‌های امروز',
    subtitle: 'ورودی + خروجی',
    icon: PhoneCall,
    iconClass: 'bg-emerald-500/12 text-emerald-700',
  },
  {
    key: 'pendingQuotes',
    label: 'پیش‌فاکتورهای منتظر',
    subtitle: 'منتظر پاسخ',
    icon: FileClock,
    iconClass: 'bg-amber-500/12 text-amber-700',
  },
];

export function TodayStrip({ today }: Props) {
  return (
    <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
      {ITEMS.map((item) => (
        <Card key={item.key} className="rounded-3xl border-slate-200/70 bg-gradient-to-br from-white to-slate-50/70">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{item.label}</CardTitle>
              <span className={`inline-flex size-9 items-center justify-center rounded-xl ${item.iconClass}`}>
                <item.icon className="size-4" />
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{item.subtitle}</p>
          </CardHeader>
          <CardContent>
            <p className="fa-num text-5xl font-black leading-none text-slate-900">{formatFaNum(today[item.key])}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
