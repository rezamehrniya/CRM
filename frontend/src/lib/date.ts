/**
 * تاریخ شمسی (جلالی) در UI — نمایش و ورودی.
 * از date-fns-jalali برای format و locale استفاده می‌شود.
 * تبدیل شمسی→میلادی با الگوریتم جلالی محلی (مطابق date-fns-jalali).
 */
import { format as formatJalaliFns } from 'date-fns-jalali';
import { faIR } from 'date-fns-jalali/locale/fa-IR';
import { digitsToFa } from './numbers';

const PERSIAN_EPOCH = 1948320;
const PERSIAN_NUM_DAYS = [0, 31, 62, 93, 124, 155, 186, 216, 246, 276, 306, 336];

function div(a: number, b: number): number {
  return ~~(a / b);
}

function mod(a: number, b: number): number {
  return a - ~~(a / b) * b;
}

function pmod(a: number, b: number): number {
  return mod(mod(a, b) + b, b);
}

function normalizeMonth(year: number, month: number): [number, number] {
  month = month - 1;
  if (month < 0) {
    const oldMonth = month;
    month = pmod(month, 12);
    year -= div(month - oldMonth, 12);
  }
  if (month > 11) {
    year += div(month, 12);
    month = mod(month, 12);
  }
  return [year, month + 1];
}

function j2d(jy: number, jm: number, jd: number): number {
  const [ny, nm] = normalizeMonth(jy, jm);
  jy = ny;
  jm = nm;
  const month = jm - 1;
  const year = jy;
  const day = jd;
  let julianDay = PERSIAN_EPOCH - 1 + 365 * (year - 1) + div(8 * year + 21, 33);
  if (month !== 0) julianDay += PERSIAN_NUM_DAYS[month];
  return julianDay + day;
}

function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let L = jdn + 68569;
  const n = div(4 * L, 146097);
  L = L - div(146097 * n + 3, 4);
  const i = div(4000 * (L + 1), 1461001);
  L = L - div(1461 * i, 4) + 31;
  const j = div(80 * L, 2447);
  const gd = L - div(2447 * j, 80);
  L = div(j, 11);
  const gm = j + 2 - 12 * L;
  const gy = 100 * (n - 49) + i + L;
  return { gy, gm, gd };
}

function jalaliToGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  return d2g(j2d(jy, jm, jd));
}

/** تاریخ/زمان ISO یا Date را به رشتهٔ شمسی (جلالی) با اعداد فارسی تبدیل می‌کند. */
export function formatJalali(
  value: Date | string | null | undefined,
  options?: { dateOnly?: boolean }
): string {
  if (value == null) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  const pattern = options?.dateOnly ? 'yyyy/MM/dd' : 'yyyy/MM/dd HH:mm';
  const formatted = formatJalaliFns(d, pattern, { locale: faIR });
  return digitsToFa(formatted);
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

/** تاریخ شمسی برای نمایش در input (فرمت yyyy/MM/dd) با اعداد فارسی. */
export function formatJalaliForInput(value: Date | string | null | undefined): string {
  if (value == null || value === '') return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return digitsToFa(formatJalaliFns(d, 'yyyy/MM/dd', { locale: faIR }));
}

/** رشتهٔ شمسی (مثلاً 1403/6/11 یا 1403-06-11) را به Date تبدیل می‌کند. */
export function parseJalaliInput(str: string): Date | null {
  const s = (str ?? '').trim().replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06F0));
  if (!s) return null;
  const parts = s.split(/[-/]/).map((p) => parseInt(p, 10)).filter((n) => !Number.isNaN(n));
  if (parts.length !== 3) return null;
  const [jy, jm, jd] = parts;
  if (jy < 1 || jy > 1500 || jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  try {
    const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);
    const date = new Date(gy, gm - 1, gd);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

/** تاریخ شمسی ورودی را به ISO date (YYYY-MM-DD) برای API تبدیل می‌کند. */
export function jalaliInputToISO(str: string): string {
  const d = parseJalaliInput(str);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** ISO date را به رشتهٔ شمسی برای input برمی‌گرداند. */
export function isoToJalaliInput(iso: string | null | undefined): string {
  if (iso == null || iso === '') return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatJalaliForInput(d);
}

/** تاریخ و زمان شمسی برای input (yyyy/MM/dd HH:mm) با اعداد فارسی. */
export function formatJalaliDateTimeForInput(value: Date | string | null | undefined): string {
  if (value == null || value === '') return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return digitsToFa(formatJalaliFns(d, 'yyyy/MM/dd HH:mm', { locale: faIR }));
}

/** رشتهٔ شمسی تاریخ+زمان (۱۴۰۳/۰۶/۱۱ ۱۴:۳۰) را به ISO برای API تبدیل می‌کند. */
export function parseJalaliDateTimeInput(str: string): Date | null {
  const s = (str ?? '').trim().replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06F0));
  const dateTimePart = s.split(/\s+/);
  const datePart = dateTimePart[0] ?? '';
  const timePart = dateTimePart[1] ?? '00:00';
  const [hh = 0, mm = 0] = timePart.split(':').map((p) => parseInt(p, 10));
  const d = parseJalaliInput(datePart);
  if (!d) return null;
  d.setHours(hh, mm, 0, 0);
  return d;
}

/** Date را به ISO string با زمان (برای datetime-local و API) تبدیل می‌کند. */
export function dateToISOString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}
