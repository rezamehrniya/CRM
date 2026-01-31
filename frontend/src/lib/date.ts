/**
 * تاریخ برای نمایش در UI با tooltip میلادی.
 * مرجع: docs/design/UI-STANDARDS.md
 * از toLocale با fa-IR استفاده می‌شود (میلادی با اعداد فارسی).
 * برای تقویم جلالی واقعی می‌توان پکیج date-fns-jalali اضافه کرد.
 */
/** تاریخ/زمان ISO یا Date را به رشته با اعداد فارسی تبدیل می‌کند. */
export function formatJalali(
  value: Date | string | null | undefined,
  options?: { dateOnly?: boolean }
): string {
  if (value == null) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  const opts: Intl.DateTimeFormatOptions = options?.dateOnly
    ? { year: 'numeric', month: '2-digit', day: '2-digit' }
    : { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
  return d.toLocaleString('fa-IR', opts);
}

/** برای tooltip میلادی (Gregorian). */
export function formatGregorian(value: Date | string, dateOnly?: boolean): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  const hasTime = dateOnly === false && (typeof value === 'string' ? value.includes('T') : true);
  return hasTime
    ? d.toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
