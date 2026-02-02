/**
 * نمایش تاریخ شمسی با tooltip میلادی (طبق UI-STANDARDS).
 */
import { formatJalali, formatGregorian } from '@/lib/date';
import { cn } from '@/lib/utils';

type JalaliDateProps = {
  value: Date | string | null | undefined;
  dateOnly?: boolean;
  className?: string;
};

export function JalaliDate({ value, dateOnly = false, className }: JalaliDateProps) {
  if (value == null) return <span className={cn('text-muted-foreground', className)}>—</span>;
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return <span className={cn('text-muted-foreground', className)}>—</span>;
  const jalali = formatJalali(value, { dateOnly });
  const gregorian = formatGregorian(value, dateOnly);
  return (
    <span
      className={cn('fa-num', className)}
      title={gregorian ? `میلادی: ${gregorian}` : undefined}
    >
      {jalali}
    </span>
  );
}
