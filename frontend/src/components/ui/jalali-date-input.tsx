/**
 * Jalali date inputs.
 * - Date input: returns ISO date string (YYYY-MM-DD)
 * - DateTime input: returns ISO datetime string (YYYY-MM-DDTHH:mm)
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  addDays,
  addMonths,
  format as formatJalaliFns,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns-jalali';
import { faIR } from 'date-fns-jalali/locale/fa-IR';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
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

const JALALI_PLACEHOLDER = '1403/06/12';
const WEEKDAY_LABELS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

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
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [displayValue, setDisplayValue] = useState(() => (value ? isoToJalaliInput(value) : ''));
  const [isFocused, setIsFocused] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(new Date()));

  const selectedDate = useMemo(() => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }, [value]);

  const calendarGridStart = useMemo(
    () => startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 6 }),
    [viewMonth]
  );

  const calendarDays = useMemo(
    () => Array.from({ length: 42 }, (_, idx) => addDays(calendarGridStart, idx)),
    [calendarGridStart]
  );

  useEffect(() => {
    if (!isFocused) setDisplayValue(value ? isoToJalaliInput(value) : '');
  }, [value, isFocused]);

  useEffect(() => {
    if (!calendarOpen) return;
    const baseDate = selectedDate ?? new Date();
    setViewMonth(startOfMonth(baseDate));
  }, [calendarOpen, selectedDate]);

  useEffect(() => {
    if (!calendarOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [calendarOpen]);

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
    if (!parsed) {
      setDisplayValue(value ? isoToJalaliInput(value) : '');
      return;
    }

    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    const isoStr = `${y}-${m}-${d}`;
    onChange(isoStr);
    setDisplayValue(isoToJalaliInput(isoStr));
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setDisplayValue(next);
    const parsed = parseJalaliInput(next);
    if (!parsed) return;

    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
  };

  const pickDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const isoStr = `${y}-${m}-${d}`;
    onChange(isoStr);
    setDisplayValue(isoToJalaliInput(isoStr));
    setCalendarOpen(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <Input
        type="text"
        inputMode="numeric"
        dir="ltr"
        id={inputId}
        className={cn('pe-10 font-medium tabular-nums', className)}
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        aria-label="تاریخ شمسی"
      />

      <button
        type="button"
        className="absolute end-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
        onClick={() => setCalendarOpen((prev) => !prev)}
        disabled={disabled}
        aria-label="باز کردن تقویم شمسی"
      >
        <CalendarDays className="size-4" />
      </button>

      {calendarOpen && (
        <div className="absolute z-50 mt-2 w-72 rounded-2xl border border-border bg-popover p-3 text-popover-foreground shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
              onClick={() => setViewMonth((prev) => addMonths(prev, -1))}
              aria-label="ماه قبل"
            >
              <ChevronRight className="size-4" />
            </button>

            <div className="text-sm font-semibold">{formatJalaliFns(viewMonth, 'MMMM yyyy', { locale: faIR })}</div>

            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
              onClick={() => setViewMonth((prev) => addMonths(prev, 1))}
              aria-label="ماه بعد"
            >
              <ChevronLeft className="size-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="py-1">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const inMonth = isSameMonth(day, viewMonth);
              const isSelected = !!selectedDate && isSameDay(day, selectedDate);

              return (
                <button
                  key={`${day.toISOString()}-day`}
                  type="button"
                  className={cn(
                    'h-8 rounded-lg text-xs transition',
                    !inMonth && 'text-muted-foreground/50',
                    inMonth && 'hover:bg-muted',
                    isSelected && 'bg-primary text-primary-foreground hover:bg-primary'
                  )}
                  onClick={() => pickDate(day)}
                >
                  {formatJalaliFns(day, 'd', { locale: faIR })}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
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

const JALALI_DATETIME_PLACEHOLDER = '1403/06/12 14:30';

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
  const [displayValue, setDisplayValue] = useState(() => (value ? isoToJalaliDateTimeDisplay(value) : ''));
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
