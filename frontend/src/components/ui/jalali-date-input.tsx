/**
 * ورودی تاریخ شمسی — مقدار و خروجی به صورت ISO (YYYY-MM-DD).
 */
import { useEffect, useId, useState } from 'react';
import {
  isoToJalaliInput,
  parseJalaliInput,
  formatJalaliDateTimeForInput,
  parseJalaliDateTimeInput,
  dateToISOString,
} from '@/lib/date';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type JalaliDateInputProps = {
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
};

const JALALI_PLACEHOLDER = '۱۴۰۳/۰۶/۱۲';

export function JalaliDateInput({
  value,
  onChange,
  placeholder = JALALI_PLACEHOLDER,
  id: idProp,
  className,
  disabled,
}: JalaliDateInputProps) {
  const id = useId();
  const inputId = idProp ?? id;
  const [displayValue, setDisplayValue] = useState(() =>
    value ? isoToJalaliInput(value) : ''
  );
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setDisplayValue(value ? isoToJalaliInput(value) : '');
  }, [value, isFocused]);

  const handleFocus = () => setIsFocused(true);

  const handleBlur = () => {
    setIsFocused(false);
    const trimmed = displayValue.trim();
    if (!trimmed) {
      onChange('');
      setDisplayValue('');
      return;
    }
    const parsed = parseJalaliInput(trimmed);
    if (parsed) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      const isoStr = `${y}-${m}-${d}`;
      onChange(isoStr);
      setDisplayValue(isoToJalaliInput(isoStr));
    } else {
      setDisplayValue(value ? isoToJalaliInput(value) : '');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setDisplayValue(v);
    const parsed = parseJalaliInput(v);
    if (parsed) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      onChange(`${y}-${m}-${day}`);
    }
  };

  return (
    <Input
      type="text"
      inputMode="numeric"
      dir="ltr"
      id={inputId}
      className={cn('font-medium tabular-nums', className)}
      placeholder={placeholder}
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      aria-label="تاریخ شمسی"
    />
  );
}

type JalaliDateTimeInputProps = {
  value: string;
  onChange: (isoDateTime: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
};

const JALALI_DATETIME_PLACEHOLDER = '۱۴۰۳/۰۶/۱۲ ۱۴:۳۰';

function isoToJalaliDateTimeDisplay(iso: string): string {
  if (!iso || !iso.trim()) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatJalaliDateTimeForInput(d);
}

function jalaliDateTimeToISO(str: string): string {
  const d = parseJalaliDateTimeInput(str);
  if (!d) return '';
  return dateToISOString(d);
}

export function JalaliDateTimeInput({
  value,
  onChange,
  placeholder = JALALI_DATETIME_PLACEHOLDER,
  id: idProp,
  className,
  disabled,
}: JalaliDateTimeInputProps) {
  const id = useId();
  const inputId = idProp ?? id;
  const [displayValue, setDisplayValue] = useState(() =>
    value ? isoToJalaliDateTimeDisplay(value) : ''
  );
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setDisplayValue(value ? isoToJalaliDateTimeDisplay(value) : '');
  }, [value, isFocused]);

  const handleFocus = () => setIsFocused(true);

  const handleBlur = () => {
    setIsFocused(false);
    const trimmed = displayValue.trim();
    if (!trimmed) {
      onChange('');
      setDisplayValue('');
      return;
    }
    const isoStr = jalaliDateTimeToISO(trimmed);
    if (isoStr) {
      onChange(isoStr);
      setDisplayValue(isoToJalaliDateTimeDisplay(isoStr));
    } else {
      setDisplayValue(value ? isoToJalaliDateTimeDisplay(value) : '');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setDisplayValue(v);
    const isoStr = jalaliDateTimeToISO(v);
    if (isoStr) onChange(isoStr);
  };

  return (
    <Input
      type="text"
      inputMode="numeric"
      dir="ltr"
      id={inputId}
      className={cn('font-medium tabular-nums', className)}
      placeholder={placeholder}
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      aria-label="تاریخ و زمان شمسی"
    />
  );
}
