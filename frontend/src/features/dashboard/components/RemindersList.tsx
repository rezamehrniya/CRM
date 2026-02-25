import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, BellRing, Clock8 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatFaNum } from '@/lib/numbers';
import { RepDashboardResponse } from '../types';

type Props = {
  reminders: RepDashboardResponse['reminders'];
};

export function RemindersList({ reminders }: Props) {
  const navigate = useNavigate();
  const totalCount = reminders.urgentFollowUps.length + reminders.waitingResponse.length;

  return (
    <Card className="rounded-3xl border-slate-200/70">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>یادآوری اقدامات</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">لیست پیگیری‌های بحرانی و موارد منتظر پاسخ</p>
          </div>
          <p className="fa-num text-4xl font-black leading-none">{formatFaNum(totalCount)}</p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 pt-0 md:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-border/70 bg-background/60 p-3">
          <div className="flex items-center justify-between">
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
              <BellRing className="size-4 text-rose-600" />
              پیگیری‌های فوری
            </p>
            <span className="fa-num rounded-full bg-rose-500/12 px-2 py-0.5 text-xs font-semibold text-rose-700">
              {formatFaNum(reminders.urgentFollowUps.length)}
            </span>
          </div>

          {reminders.urgentFollowUps.length === 0 && (
            <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              پیگیری فوری وجود ندارد.
            </p>
          )}

          {reminders.urgentFollowUps.length > 0 && (
            <div className="max-h-[260px] space-y-2 overflow-auto pe-1">
              {reminders.urgentFollowUps.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  type="button"
                  onClick={() => navigate(item.type === 'LEAD' ? `../leads?leadId=${item.id}` : `../tasks/${item.id}`)}
                  className="group w-full rounded-xl border border-border/70 bg-background/80 p-3 text-right transition hover:bg-background"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.dueAt}</p>
                    </div>
                    <ArrowUpRight className="mt-0.5 size-4 text-slate-500 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-900" />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="rounded-full bg-slate-500/10 px-2 py-0.5">
                      {item.type === 'LEAD' ? 'لید' : 'کار'}
                    </span>
                    <span className="fa-num rounded-full bg-rose-500/10 px-2 py-0.5 text-rose-700">
                      {formatFaNum(item.overdueDays)} روز معوق
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-2xl border border-border/70 bg-background/60 p-3">
          <div className="flex items-center justify-between">
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
              <Clock8 className="size-4 text-amber-600" />
              در انتظار پاسخ
            </p>
            <span className="fa-num rounded-full bg-amber-500/12 px-2 py-0.5 text-xs font-semibold text-amber-700">
              {formatFaNum(reminders.waitingResponse.length)}
            </span>
          </div>

          {reminders.waitingResponse.length === 0 && (
            <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              آیتمی در انتظار پاسخ وجود ندارد.
            </p>
          )}

          {reminders.waitingResponse.length > 0 && (
            <div className="max-h-[260px] space-y-2 overflow-auto pe-1">
              {reminders.waitingResponse.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(`../quotes/${item.id}`)}
                  className="group w-full rounded-xl border border-border/70 bg-background/80 p-3 text-right transition hover:bg-background"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">پیش‌فاکتور منتظر اقدام مشتری</p>
                    </div>
                    <ArrowUpRight className="mt-0.5 size-4 text-slate-500 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-900" />
                  </div>
                  <p className="fa-num mt-2 inline-flex rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    {formatFaNum(item.sinceDays)} روز انتظار
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
