/**
 * داشبورد فروش — خلاصهٔ عملکرد امروز + ریسک‌ها.
 * برای فروشنده (MEMBER): کارهای امروز من، معاملات من (SAK-016).
 * طراحی: Aurora/Glass، خوانایی در حالت داده / خطا / بارگذاری / خالی.
 */
import { useState, useEffect } from 'react';
import { Users, HandCoins, Banknote, CheckSquare, UserCheck, Briefcase } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { PageBreadcrumb } from '@/components/PageBreadcrumb';
import { DashboardErrorBanner, DashboardCard } from '@/components/dashboard';

type Kpis = {
  contactsCount: number;
  dealsCount: number;
  tasksDueToday: number;
  pipelineValue: string;
  myTasksDueToday?: number;
  myDealsCount?: number;
};

export default function Dashboard() {
  const { role } = useAuth();
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Kpis>('/dashboard')
      .then(setKpis)
      .catch((e) => setError(e?.message ?? 'خطا'))
      .finally(() => setLoading(false));
  }, []);

  const hasError = Boolean(error);
  const showLoading = loading && !kpis;
  const isSeller = role === 'MEMBER';
  const showMyKpis = isSeller && (kpis?.myTasksDueToday !== undefined || kpis?.myDealsCount !== undefined);

  return (
    <div className="space-y-6">
      <PageBreadcrumb current="داشبورد" />
      <h1 className="text-title-lg font-title">داشبورد</h1>

      {hasError && (
        <DashboardErrorBanner />
      )}

      {showMyKpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          <DashboardCard
            title="کارهای امروز من"
            icon={UserCheck}
            value={kpis?.myTasksDueToday ?? 0}
            loading={showLoading}
            emptyMessage="هیچ کاری برای امروز ندارید"
          />
          <DashboardCard
            title="معاملات من"
            icon={Briefcase}
            value={kpis?.myDealsCount ?? 0}
            loading={showLoading}
            emptyMessage="هیچ معامله‌ای به شما اختصاص نیست"
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
        <DashboardCard
          title="مخاطبین"
          icon={Users}
          value={kpis?.contactsCount}
          loading={showLoading}
          emptyMessage="—"
        />
        <DashboardCard
          title="معاملات"
          icon={HandCoins}
          value={kpis?.dealsCount}
          loading={showLoading}
          emptyMessage="هیچ معامله‌ای ثبت نشده"
        />
        <DashboardCard
          title="ارزش پایپلاین"
          icon={Banknote}
          value={kpis?.pipelineValue}
          loading={showLoading}
          emptyMessage="—"
          suffixToman
        />
        <DashboardCard
          title="کارهای امروز"
          icon={CheckSquare}
          value={kpis?.tasksDueToday}
          loading={showLoading}
          emptyMessage="هیچ کاری ثبت نیست"
        />
      </div>
    </div>
  );
}
