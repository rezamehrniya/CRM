const STAGE_LABEL_MAP: Record<string, string> = {
  cold: 'سرد',
  warm: 'گرم',
  qualified: 'واجد شرایط',
  'quote sent': 'ارسال پیش‌فاکتور',
  quotesent: 'ارسال پیش‌فاکتور',
  quote_sent: 'ارسال پیش‌فاکتور',
  negotiation: 'مذاکره',
  'signed contract': 'قرارداد امضاشده',
  signedcontract: 'قرارداد امضاشده',
  signed_contract: 'قرارداد امضاشده',
  'closed won': 'بسته‌شده موفق',
  closedwon: 'بسته‌شده موفق',
  won: 'بسته‌شده موفق',
  'closed lost': 'از دست‌رفته',
  closedlost: 'از دست‌رفته',
  lost: 'از دست‌رفته',
  new: 'جدید',
};

function normalizeStageLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function toFaStageLabel(label?: string | null, key?: string | null) {
  const candidates = [String(label ?? ''), String(key ?? '')].map(normalizeStageLabel).filter(Boolean);
  for (const candidate of candidates) {
    const mapped = STAGE_LABEL_MAP[candidate];
    if (mapped) return mapped;
  }
  return String(label ?? key ?? '');
}

