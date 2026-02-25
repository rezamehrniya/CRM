const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const DASH = '—';
const ARABIC_THOUSANDS_SEPARATOR = /\u066C/g;

export function digitsToFa(value: string | null | undefined): string {
  if (value == null || value === '') return DASH;
  return String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export function formatFaNum(
  value: number | string | null | undefined,
  options?: Intl.NumberFormatOptions,
): string {
  if (value == null || value === '') return DASH;
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return DASH;
  return n.toLocaleString('fa-IR', options).replace(ARABIC_THOUSANDS_SEPARATOR, ',');
}

type CurrencyUnit = 'TOMAN' | 'RIAL';

type FormatFaCurrencyOptions = {
  sourceUnit?: CurrencyUnit;
  outputUnit?: CurrencyUnit;
  showUnit?: boolean;
};

// Amounts in this CRM are currently stored in Toman. Default output is Rial.
export function formatFaCurrency(
  value: number | string | null | undefined,
  options?: FormatFaCurrencyOptions,
): string {
  if (value == null || value === '') return DASH;

  const raw = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(raw)) return DASH;

  const sourceUnit = options?.sourceUnit ?? 'TOMAN';
  const outputUnit = options?.outputUnit ?? 'RIAL';
  const showUnit = options?.showUnit ?? true;

  let normalized = raw;
  if (sourceUnit !== outputUnit) {
    normalized = sourceUnit === 'TOMAN' ? raw * 10 : raw / 10;
  }

  const amount = formatFaNum(Math.round(normalized));
  if (!showUnit) return amount;
  return `${amount} ${outputUnit === 'RIAL' ? 'ریال' : 'تومان'}`;
}
