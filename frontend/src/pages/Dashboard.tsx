/**
 * داشبورد فروش — خلاصهٔ عملکرد امروز + ریسک‌ها.
 * برای فروشنده (MEMBER): کارهای امروز من، معاملات من (SAK-016).
 * طراحی: Aurora/Glass، خوانایی در حالت داده / خطا / بارگذاری / خالی.
 */
import { useState, useEffect } from 'react';
import { format } from 'date-fns-jalali';
import {
  Users,
  HandCoins,
  Banknote,
  CheckSquare,
  UserCheck,
  Briefcase,
  Activity,
  Target,
  Trophy,
  TrendingUp,
} from 'lucide-react';
// برای چارت‌ها
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { PageBreadcrumb } from '@/components/PageBreadcrumb';
import { DashboardErrorBanner } from '@/components/dashboard/DashboardErrorBanner';
import { DashboardCard } from '@/components/dashboard/DashboardCard';

type OwnerDashboardResponse = {
  kpis: {
    newLeadsToday: number;
    newLeadsThisWeek: number;
    overdueFollowUps: number;
    openDealsCount: number;
    pipelineValueSum: number;
    forecastToMonthEnd: number;
    wonDealsCountThisMonth: number;
    lostDealsCountThisMonth: number;
    avgDaysToClose: number;
  };
  charts: {
    leadsFunnel: { status: string; count: number }[];
    pipelineByStage: { stage: string; count: number; sumAmount: number }[];
    trend30d: { date: string; leads: number; wonDeals: number; activities: number }[];
    dealAging: { bucket: string; count: number; sumAmount: number }[];
    topSellers: { userId: string; name: string; wonDeals: number; pipelineValue: number; activities: number }[];
  };
  lists: {
    overdueLeads: {
      id: string;
      firstName: string;
      lastName: string;
      phone: string | null;
      companyName: string | null;
      followUpAt: string;
      ownerUserId: string | null;
    }[];
    hotDeals: {
      id: string;
      title: string;
      stage: string;
      amount: number;
      expectedCloseDate: string | null;
      ownerUserId: string | null;
    }[];
    recentActivities: {
      id: string;
      type: string;
      body: string | null;
      happenedAt: string;
      createdByUserId: string | null;
      contact: { id: string; firstName: string; lastName: string } | null;
      deal: { id: string; title: string } | null;
    }[];
  };
};

type MemberKpis = {
  contactsCount: number;
  dealsCount: number;
  tasksDueToday: number;
  pipelineValue: string;
  myTasksDueToday?: number;
  myDealsCount?: number;
};

const formatJalali = (value: string | null | undefined): string => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'yyyy/MM/dd');
};

const buildMockOwnerDashboard = (): OwnerDashboardResponse => {
  const today = new Date();
  const iso = (offsetDays: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - offsetDays);
    return d.toISOString().slice(0, 10);
  };
  return {
    kpis: {
      newLeadsToday: 5,
      newLeadsThisWeek: 28,
      overdueFollowUps: 7,
      openDealsCount: 18,
      pipelineValueSum: 1250000000,
      forecastToMonthEnd: 420000000,
      wonDealsCountThisMonth: 6,
      lostDealsCountThisMonth: 2,
      avgDaysToClose: 14,
    },
    charts: {
      leadsFunnel: [
        { status: 'NEW', count: 40 },
        { status: 'CONTACTED', count: 28 },
        { status: 'QUALIFIED', count: 12 },
        { status: 'CONVERTED', count: 6 },
        { status: 'LOST', count: 7 },
      ],
      pipelineByStage: [
        { stage: 'جدید', count: 6, sumAmount: 180000000 },
        { stage: 'گرم', count: 7, sumAmount: 420000000 },
        { stage: 'ارسال پیش‌فاکتور', count: 4, sumAmount: 520000000 },
        { stage: 'بسته شده', count: 1, sumAmount: 30000000 },
      ],
      trend30d: [
        { date: iso(5), leads: 3, wonDeals: 1, activities: 6 },
        { date: iso(4), leads: 5, wonDeals: 0, activities: 4 },
        { date: iso(3), leads: 4, wonDeals: 1, activities: 7 },
        { date: iso(2), leads: 6, wonDeals: 2, activities: 10 },
        { date: iso(1), leads: 2, wonDeals: 0, activities: 5 },
        { date: iso(0), leads: 5, wonDeals: 1, activities: 8 },
      ],
      dealAging: [
        { bucket: '0-7', count: 6, sumAmount: 240000000 },
        { bucket: '8-14', count: 4, sumAmount: 180000000 },
        { bucket: '15-30', count: 5, sumAmount: 390000000 },
        { bucket: '30+', count: 3, sumAmount: 440000000 },
      ],
      topSellers: [
        {
          userId: '1',
          name: 'علی محمدی',
          wonDeals: 3,
          pipelineValue: 500000000,
          activities: 28,
        },
        {
          userId: '2',
          name: 'سارا رضایی',
          wonDeals: 2,
          pipelineValue: 420000000,
          activities: 22,
        },
      ],
    },
    lists: {
      overdueLeads: [],
      hotDeals: [],
      recentActivities: [],
    },
  };
};

export default function Dashboard() {
  const { role } = useAuth();
  const [ownerData, setOwnerData] = useState<OwnerDashboardResponse | null>(null);
  const [memberKpis, setMemberKpis] = useState<MemberKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOwner = role === 'OWNER';
  const isSeller = role === 'MEMBER';

  useEffect(() => {
    setLoading(true);
    setError(null);
    if (isOwner) {
      apiGet<OwnerDashboardResponse>('/dashboard/owner')
        .then(setOwnerData)
        .catch((e) => {
          setError(e?.message ?? 'خطا');
          // برای دمو، در صورت خطا دیتای فیک نمایش داده می‌شود.
          setOwnerData(buildMockOwnerDashboard());
        })
        .finally(() => setLoading(false));
    } else {
      apiGet<MemberKpis>('/dashboard')
        .then(setMemberKpis)
        .catch((e) => setError(e?.message ?? 'خطا'))
        .finally(() => setLoading(false));
    }
  }, [isOwner]);

  const hasError = Boolean(error);
  const showLoadingOwner = loading && isOwner && !ownerData;
  const showLoadingMember = loading && !isOwner && !memberKpis;
  const showMyKpis =
    isSeller &&
    (memberKpis?.myTasksDueToday !== undefined || memberKpis?.myDealsCount !== undefined);

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
            value={memberKpis?.myTasksDueToday ?? 0}
            loading={showLoadingMember}
            emptyMessage="هیچ کاری برای امروز ندارید"
          />
          <DashboardCard
            title="معاملات من"
            icon={Briefcase}
            value={memberKpis?.myDealsCount ?? 0}
            loading={showLoadingMember}
            emptyMessage="هیچ معامله‌ای به شما اختصاص نیست"
          />
        </div>
      )}

      {/* داشبورد OWNER: KPI + چارت‌ها + لیست‌ها */}
      {isOwner && (
        <div className="space-y-8">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            <DashboardCard
              title="لیدهای جدید امروز"
              icon={Users}
              value={ownerData?.kpis.newLeadsToday}
              loading={showLoadingOwner}
            />
            <DashboardCard
              title="لیدهای جدید این هفته"
              icon={Users}
              value={ownerData?.kpis.newLeadsThisWeek}
              loading={showLoadingOwner}
            />
            <DashboardCard
              title="پیگیری‌های عقب‌افتاده"
              icon={Target}
              value={ownerData?.kpis.overdueFollowUps}
              loading={showLoadingOwner}
            />
            <DashboardCard
              title="معاملات باز"
              icon={HandCoins}
              value={ownerData?.kpis.openDealsCount}
              loading={showLoadingOwner}
            />
            <DashboardCard
              title="ارزش پایپلاین"
              icon={Banknote}
              value={ownerData?.kpis.pipelineValueSum}
              loading={showLoadingOwner}
              suffixToman
            />
            <DashboardCard
              title="پیش‌بینی تا پایان ماه"
              icon={TrendingUp}
              value={ownerData?.kpis.forecastToMonthEnd}
              loading={showLoadingOwner}
              suffixToman
            />
            <DashboardCard
              title="برد این ماه"
              icon={Trophy}
              value={ownerData?.kpis.wonDealsCountThisMonth}
              loading={showLoadingOwner}
            />
            <DashboardCard
              title="میانگین زمان بستن (روز)"
              icon={CheckSquare}
              value={ownerData?.kpis.avgDaysToClose}
              loading={showLoadingOwner}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Leads Funnel */}
            <section className="glass-card rounded-2xl p-4 shadow-md">
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">فانل لیدها (این ماه)</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ownerData?.charts.leadsFunnel ?? []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="status" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#4f46e5" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Pipeline by Stage */}
            <section className="glass-card rounded-2xl p-4 shadow-md">
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">پایپلاین بر اساس مرحله</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ownerData?.charts.pipelineByStage ?? []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="stage" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="sumAmount" name="مبلغ" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Trend 30 days */}
            <section className="glass-card rounded-2xl p-4 shadow-md lg:col-span-2">
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                روند لیدها، معاملات بسته‌شده و فعالیت‌ها (۳۰ روز اخیر)
              </h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={(ownerData?.charts.trend30d ?? []).map((d) => ({
                  ...d,
                  label: formatJalali(d.date),
                }))}
              >
                    <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="leads" name="لیدها" stroke="#3b82f6" />
                    <Line type="monotone" dataKey="wonDeals" name="معاملات برنده" stroke="#22c55e" />
                    <Line type="monotone" dataKey="activities" name="فعالیت‌ها" stroke="#f97316" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Deal Aging */}
            <section className="glass-card rounded-2xl p-4 shadow-md">
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                قدیمی شدن معاملات باز (روز)
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ownerData?.charts.dealAging ?? []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="bucket" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" name="تعداد" fill="#a855f7" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Top Sellers */}
            <section className="glass-card rounded-2xl p-4 shadow-md">
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">برترین فروشندگان (این ماه)</h2>
              <div className="h-64 overflow-auto">
                <ul className="space-y-3">
                  {(ownerData?.charts.topSellers ?? []).map((s) => (
                    <li
                      key={s.userId}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-semibold">
                          {s.name.charAt(0)}
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium truncate">{s.name}</span>
                          <span className="text-xs text-muted-foreground">
                            معاملات برنده: {s.wonDeals} • ارزش پایپلاین: {s.pipelineValue.toLocaleString('fa-IR')}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        فعالیت‌ها: {s.activities}
                      </span>
                    </li>
                  ))}
                  {(ownerData?.charts.topSellers?.length ?? 0) === 0 && !showLoadingOwner && (
                    <p className="text-xs text-muted-foreground">داده‌ای برای نمایش وجود ندارد.</p>
                  )}
                </ul>
              </div>
            </section>
          </div>

          {/* Operational lists */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Overdue follow-ups */}
            <section className="glass-card rounded-2xl p-4 shadow-md">
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                پیگیری‌های عقب‌افتاده (Top 10)
              </h2>
              <div className="space-y-2 text-xs">
                {(ownerData?.lists.overdueLeads ?? []).map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {l.firstName} {l.lastName}
                      </span>
                      <span className="text-muted-foreground">
                        {l.phone || 'بدون شماره'} • {l.companyName || 'بدون شرکت'}
                      </span>
                      <span className="text-muted-foreground">
                        سررسید: {formatJalali(l.followUpAt)}
                      </span>
                    </div>
                  </div>
                ))}
                {(ownerData?.lists.overdueLeads?.length ?? 0) === 0 && !showLoadingOwner && (
                  <p className="text-muted-foreground">مورد عقب‌افتاده‌ای وجود ندارد.</p>
                )}
              </div>
            </section>

            {/* Hot deals */}
            <section className="glass-card rounded-2xl p-4 shadow-md">
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">معاملات داغ (Top 10)</h2>
              <div className="space-y-2 text-xs">
                {(ownerData?.lists.hotDeals ?? []).map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{d.title}</span>
                      <span className="text-muted-foreground">
                        مرحله: {d.stage} • مبلغ: {d.amount.toLocaleString('fa-IR')}
                      </span>
                      <span className="text-muted-foreground">
                        تاریخ پیش‌بینی بستن: {formatJalali(d.expectedCloseDate)}
                      </span>
                    </div>
                  </div>
                ))}
                {(ownerData?.lists.hotDeals?.length ?? 0) === 0 && !showLoadingOwner && (
                  <p className="text-muted-foreground">معامله‌ی داغی برای نمایش نیست.</p>
                )}
              </div>
            </section>

            {/* Recent activities */}
            <section className="glass-card rounded-2xl p-4 shadow-md">
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                فعالیت‌های اخیر
              </h2>
              <div className="space-y-2 text-xs max-h-72 overflow-auto">
                {(ownerData?.lists.recentActivities ?? []).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <Activity className="mt-0.5 size-3.5 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {a.type} • {a.contact ? `${a.contact.firstName} ${a.contact.lastName}` : a.deal?.title ?? ''}
                      </span>
                      {a.body && <span className="text-muted-foreground">{a.body}</span>}
                      <span className="text-muted-foreground">
                        تاریخ: {formatJalali(a.happenedAt)}
                      </span>
                    </div>
                  </div>
                ))}
                {(ownerData?.lists.recentActivities?.length ?? 0) === 0 && !showLoadingOwner && (
                  <p className="text-muted-foreground">فعالیتی ثبت نشده است.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* داشبورد ساده برای MEMBER و سایر نقش‌ها (نسخه قبلی) */}
      {!isOwner && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          <DashboardCard
            title="مخاطبین"
            icon={Users}
            value={memberKpis?.contactsCount}
            loading={showLoadingMember}
            emptyMessage="—"
          />
          <DashboardCard
            title="معاملات"
            icon={HandCoins}
            value={memberKpis?.dealsCount}
            loading={showLoadingMember}
            emptyMessage="هیچ معامله‌ای ثبت نشده"
          />
          <DashboardCard
            title="ارزش پایپلاین"
            icon={Banknote}
            value={memberKpis?.pipelineValue}
            loading={showLoadingMember}
            emptyMessage="—"
            suffixToman
          />
          <DashboardCard
            title="کارهای امروز"
            icon={CheckSquare}
            value={memberKpis?.tasksDueToday}
            loading={showLoadingMember}
            emptyMessage="هیچ کاری ثبت نیست"
          />
        </div>
      )}
    </div>
  );
}
