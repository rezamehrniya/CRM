/**
 * اعداد فارسی برای نمایش در UI (۰–۹).
 * با فونت FaNum (مثلاً Vazirmatn FaNum) نمایش داده شود.
 */
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
