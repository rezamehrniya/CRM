/**
 * اعداد فارسی برای نمایش در UI (۰–۹).
 * با فونت Peyda FaNum (کلاس .fa-num) نمایش داده شود.
 */

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** رقم‌های ASCII (0–9) را در رشته به فارسی (۰–۹) تبدیل می‌کند. برای تلفن و هر متنی که عدد دارد. */
export function digitsToFa(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  return String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/** عدد یا رشتهٔ عددی را به صورت اعداد فارسی برمی‌گرداند. */
export function formatFaNum(
  value: number | string | null | undefined,
  options?: Intl.NumberFormatOptions
): string {
  if (value == null || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('fa-IR', options);
}
