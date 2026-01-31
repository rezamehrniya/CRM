/**
 * نوار هشدار بالا — فقط در صورت خطای واقعی API.
 * سبک: Aurora/Glass، صورتی/قرمز ملایم.
 */
import { AlertOctagon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const MESSAGE = 'ارتباط با سرور برقرار نشد. لطفاً اتصال را بررسی کنید.';

export function DashboardErrorBanner() {
  return (
    <Alert
      role="alert"
      className="flex items-center gap-3 rounded-2xl border-destructive/30 bg-destructive/10 text-destructive shadow-md"
    >
      <AlertOctagon className="size-5 shrink-0" aria-hidden />
      <AlertDescription className="text-sm font-medium">{MESSAGE}</AlertDescription>
    </Alert>
  );
}
