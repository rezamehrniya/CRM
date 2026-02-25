/**
 * نوار هشدار بالا — فقط در صورت خطای واقعی API.
 * سبک: Aurora/Glass، صورتی/قرمز ملایم.
 */
import { AlertOctagon } from 'lucide-react';

const MESSAGE = 'ارتباط با سرور برقرار نشد. لطفاً اتصال را بررسی کنید.';

export function DashboardErrorBanner() {
  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 shadow-sm"
    >
      <AlertOctagon className="size-4 shrink-0" aria-hidden />
      <span className="font-medium">{MESSAGE}</span>
    </div>
  );
}
