/**
 * صفحهٔ یکپارچه برای حالت‌های خطا و Maintenance
 * استفاده: داخل Layout (با sidebar) یا تمام‌صفحه (مثلاً ۴۰۴ خارج از اپ)
 */
import { useNavigate } from 'react-router-dom';
import { Wrench, FileQuestion, ShieldAlert, LogIn, ServerCrash, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

export type ErrorPageVariant =
  | 'maintenance'
  | '404'
  | '403'
  | '401'
  | '500'
  | 'offline';

type ErrorPageProps = {
  variant: ErrorPageVariant;
  title?: string;
  description?: string;
  /** لینک دکمهٔ اصلی (مثلاً بازگشت به داشبورد). اگه نباشه دکمه نمایش داده نمی‌شود. */
  actionHref?: string;
  actionLabel?: string;
  /** برای خطای عمومی: دکمه «تلاش مجدد» با فراخوانی این تابع */
  onRetry?: () => void;
  /** اگر true، فقط محتوا (برای قرار گرفتن داخل Layout). اگر false، تمام صفحه با aurora-bg */
  inline?: boolean;
  className?: string;
};

const variantConfig: Record<
  ErrorPageVariant,
  { icon: typeof Wrench; defaultTitle: string; defaultDescription: string }
> = {
  maintenance: {
    icon: Wrench,
    defaultTitle: 'در حال به‌روزرسانی',
    defaultDescription: 'سیستم موقتاً در دسترس نیست. لطفاً چند دقیقهٔ دیگر تلاش کنید.',
  },
  '404': {
    icon: FileQuestion,
    defaultTitle: 'صفحه یافت نشد',
    defaultDescription: 'آدرس وارد شده معتبر نیست یا صفحه حذف شده است.',
  },
  '403': {
    icon: ShieldAlert,
    defaultTitle: 'دسترسی غیرمجاز',
    defaultDescription: 'شما به این بخش دسترسی ندارید.',
  },
  '401': {
    icon: LogIn,
    defaultTitle: 'ورود مجدد لازم است',
    defaultDescription: 'نشست شما منقضی شده. لطفاً دوباره وارد شوید.',
  },
  '500': {
    icon: ServerCrash,
    defaultTitle: 'خطای سرور',
    defaultDescription: 'مشکلی پیش آمده. لطفاً بعداً تلاش کنید یا با پشتیبانی تماس بگیرید.',
  },
  offline: {
    icon: ServerCrash,
    defaultTitle: 'اتصال برقرار نیست',
    defaultDescription: 'اتصال اینترنت خود را بررسی کنید و دوباره تلاش کنید.',
  },
};

export function ErrorPage({
  variant,
  title,
  description,
  actionHref,
  actionLabel,
  onRetry,
  inline = false,
  className,
}: ErrorPageProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;
  const displayTitle = title ?? config.defaultTitle;
  const displayDescription = description ?? config.defaultDescription;

  const navigate = useNavigate();
  const defaultActionLabels: Partial<Record<ErrorPageVariant, string>> = {
    maintenance: 'برگشت به شروع',
    '404': 'برگشت به داشبورد',
    '403': 'برگشت',
    '401': 'ورود',
    '500': 'تلاش مجدد',
    offline: 'تلاش مجدد',
  };
  const label = actionLabel ?? (actionHref ? defaultActionLabels[variant] : undefined);

  const content = (
    <div className={cn('flex flex-col items-center justify-center text-center px-4 py-8', className)}>
      <div className="glass-card rounded-panel p-6 md:p-10 max-w-md w-full flex flex-col items-center gap-4">
        <div
          className={cn(
            'rounded-full p-4',
            variant === 'maintenance' && 'bg-primary/15 text-primary',
            variant === '404' && 'bg-muted text-muted-foreground',
            (variant === '403' || variant === '401') && 'bg-destructive/15 text-destructive',
            (variant === '500' || variant === 'offline') && 'bg-destructive/15 text-destructive'
          )}
        >
          <Icon className="size-10 md:size-12" aria-hidden />
        </div>
        <h1 className="text-title-lg font-title text-foreground">{displayTitle}</h1>
        <p className="text-muted-foreground text-sm md:text-base">{displayDescription}</p>
        <div className="flex flex-wrap gap-2 justify-center mt-2">
          {actionHref && label && (
            <Button type="button" onClick={() => navigate(actionHref)}>
              {label}
            </Button>
          )}
          {onRetry && (
            <Button variant="outline" onClick={onRetry} className="gap-2">
              <RefreshCw className="size-4" aria-hidden />
              تلاش مجدد
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  if (inline) {
    return content;
  }

  return (
    <div className="aurora-bg min-h-screen flex flex-col bg-background text-foreground">
      {content}
    </div>
  );
}
