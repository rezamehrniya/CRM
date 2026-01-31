/**
 * کارت KPI داشبورد — عنوان + مقدار + آیکون + حالت‌های loading / خالی / خطا.
 * اعداد با formatFaNum و فونت FaNum نمایش داده می‌شوند.
 */
import type { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatFaNum } from '@/lib/numbers';

type DashboardCardProps = {
  title: string;
  icon: LucideIcon;
  /** مقدار نمایشی (عدد یا رشته). در حالت loading/empty نادیده گرفته می‌شود. */
  value?: string | number | null;
  loading?: boolean;
  /** متن در حالت خالی/خطا (مثلاً "—" یا "هیچ معامله‌ای ثبت نشده") */
  emptyMessage?: string;
  /** اگر true، بعد از عدد " تومان" اضافه می‌شود (مثلاً ارزش پایپلاین) */
  suffixToman?: boolean;
  className?: string;
};

export function DashboardCard({
  title,
  icon: Icon,
  value,
  loading,
  emptyMessage = '—',
  suffixToman,
  className,
}: DashboardCardProps) {
  const isEmpty = !loading && (value === undefined || value === null || value === '');
  const isNum = typeof value === 'number' || (typeof value === 'string' && value !== '' && !Number.isNaN(Number(value)));
  const displayValue = isEmpty
    ? emptyMessage
    : suffixToman
      ? `${formatFaNum(value)} تومان`
      : isNum
        ? formatFaNum(value)
        : String(value);

  return (
    <div
      className={cn(
        'glass-card rounded-2xl p-5 shadow-md transition-shadow hover:shadow-lg',
        className
      )}
    >
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <div className="mt-2 flex items-center gap-2">
        <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        {loading ? (
          <Skeleton className="h-8 w-20 rounded-lg bg-white/20" />
        ) : (
          <p
            className={cn(
              'text-2xl font-bold tabular-nums fa-num',
              isEmpty ? 'text-muted-foreground' : 'text-foreground'
            )}
          >
            {displayValue}
          </p>
        )}
      </div>
    </div>
  );
}
