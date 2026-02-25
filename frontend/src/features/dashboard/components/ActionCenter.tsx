import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, CircleAlert, Gem, Handshake } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatJalali } from '@/lib/date';
import { formatFaCurrency, formatFaNum } from '@/lib/numbers';
import { ManagerOverviewResponse } from '../types';
import { toFaStageLabel } from '../label-utils';

type Props = {
  data: ManagerOverviewResponse['actionCenter'];
};

function EmptyState({ label }: { label: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
      {label}
    </p>
  );
}

export function ActionCenter({ data }: Props) {
  const navigate = useNavigate();

  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="rounded-3xl border-slate-200/70">
        <CardHeader className="space-y-3 pb-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-700">
              <Gem className="size-4" />
            </span>
            <p className="fa-num text-4xl font-black">{formatFaNum(data.topOpportunities.length)}</p>
          </div>
          <div>
            <CardTitle>فرصت‌های برتر</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">فرصت‌های کلیدی با بیشترین اثر روی خروجی این بازه</p>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {data.topOpportunities.length === 0 && <EmptyState label="فرصت باارزش فعالی وجود ندارد." />}
          {data.topOpportunities.length > 0 && (
            <div className="max-h-[250px] space-y-2 overflow-auto pe-1">
              {data.topOpportunities.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(`../quotes/${item.id}`)}
                  className="group w-full rounded-2xl border border-border/70 bg-background/70 p-3 text-right transition hover:bg-background"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.company}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        مرحله: {toFaStageLabel(item.stage)} • مالک: {item.owner}
                      </p>
                    </div>
                    <ArrowUpRight className="mt-0.5 size-4 text-slate-500 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-900" />
                  </div>
                  <p className="fa-num mt-2 text-sm font-semibold text-slate-700">{formatFaCurrency(item.amount)}</p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-slate-200/70">
        <CardHeader className="space-y-3 pb-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-rose-500/12 text-rose-700">
              <CircleAlert className="size-4" />
            </span>
            <p className="fa-num text-4xl font-black">{formatFaNum(data.overdueLeads.length)}</p>
          </div>
          <div>
            <CardTitle>لیدهای معوق</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">لیدهایی که از زمان پیگیری عبور کرده‌اند</p>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {data.overdueLeads.length === 0 && <EmptyState label="پیگیری معوقی وجود ندارد." />}
          {data.overdueLeads.length > 0 && (
            <div className="max-h-[250px] space-y-2 overflow-auto pe-1">
              {data.overdueLeads.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(`../leads?leadId=${item.id}`)}
                  className="group w-full rounded-2xl border border-border/70 bg-background/70 p-3 text-right transition hover:bg-background"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">مالک: {item.owner}</p>
                    </div>
                    <ArrowUpRight className="mt-0.5 size-4 text-slate-500 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-900" />
                  </div>
                  <p className="fa-num mt-2 inline-flex items-center rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                    {formatFaNum(item.overdueDays)} روز معوق
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-slate-200/70">
        <CardHeader className="space-y-3 pb-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-blue-500/12 text-blue-700">
              <Handshake className="size-4" />
            </span>
            <p className="fa-num text-4xl font-black">{formatFaNum(data.contractsThisWeek.length)}</p>
          </div>
          <div>
            <CardTitle>قراردادهای این هفته</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">قراردادهای امضاشده برای پیش‌بینی کوتاه‌مدت</p>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {data.contractsThisWeek.length === 0 && <EmptyState label="قرارداد امضاشده‌ای در این هفته ثبت نشده است." />}
          {data.contractsThisWeek.length > 0 && (
            <div className="max-h-[250px] space-y-2 overflow-auto pe-1">
              {data.contractsThisWeek.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(`../quotes/${item.id}`)}
                  className="group w-full rounded-2xl border border-border/70 bg-background/70 p-3 text-right transition hover:bg-background"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.company}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatJalali(item.signedAt, { dateOnly: true })}
                      </p>
                    </div>
                    <ArrowUpRight className="mt-0.5 size-4 text-slate-500 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-900" />
                  </div>
                  <p className="fa-num mt-2 text-sm font-semibold text-slate-700">{formatFaCurrency(item.amount)}</p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
