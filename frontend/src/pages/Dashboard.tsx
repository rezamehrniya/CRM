import { useEffect, useMemo, useState } from 'react';
import { PageBreadcrumb } from '@/components/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { getManagerOverview, getManagerTeam, getRepDashboard } from '@/features/dashboard/api';
import { ManagerDashboard } from '@/features/dashboard/ManagerDashboard';
import { RepDashboard } from '@/features/dashboard/RepDashboard';
import { ManagerOverviewResponse, ManagerTeamResponse, RepDashboardResponse, TeamSortBy } from '@/features/dashboard/types';

type ViewMode = 'manager' | 'rep' | 'unauthorized';

function normalizeRole(raw?: string | null): string {
  const value = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (value === 'OWNER') return 'ADMIN';
  if (value === 'MEMBER') return 'SALES_REP';
  if (value === 'SALESREP') return 'SALES_REP';
  if (value === 'SALESMANAGER') return 'SALES_MANAGER';
  return value;
}

function roleFromRoleName(raw?: string | null): string | null {
  const source = String(raw ?? '').trim();
  if (!source) return null;
  const value = source.toUpperCase();
  if (value === 'ADMIN' || value.includes('ADMIN')) return 'ADMIN';
  if (value === 'SALES_MANAGER' || value.includes('MANAGER') || source.includes('مدیر')) return 'SALES_MANAGER';
  if (value === 'SALES_REP' || value.includes('SALES REP') || value.includes('REP') || source.includes('فروش')) return 'SALES_REP';
  if (value === 'VIEWER' || value.includes('VIEWER') || source.includes('بیننده')) return 'VIEWER';
  return null;
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getDefaultRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: toIsoDate(start),
    to: toIsoDate(now),
  };
}

function toDashboardError(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : '';
  if (/forbidden|insufficient permissions|unauthorized/i.test(message)) {
    return 'شما دسترسی لازم برای مشاهده این بخش را ندارید.';
  }
  return message || fallback;
}

export default function Dashboard() {
  const { role, roleName, loading: authLoading, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<TeamSortBy>('revenue');
  const [overview, setOverview] = useState<ManagerOverviewResponse | null>(null);
  const [team, setTeam] = useState<ManagerTeamResponse | null>(null);
  const [repData, setRepData] = useState<RepDashboardResponse | null>(null);

  const normalizedRole = useMemo(
    () => normalizeRole(role ?? roleFromRoleName(roleName) ?? null),
    [role, roleName],
  );

  const mode = useMemo<ViewMode>(() => {
    if (normalizedRole === 'ADMIN' || normalizedRole === 'SALES_MANAGER') return 'manager';
    if (normalizedRole === 'SALES_REP') return 'rep';
    if (hasPermission('dashboard.manage')) return 'manager';
    if (hasPermission('dashboard.read')) return 'rep';
    if (hasPermission('leads.read') || hasPermission('tasks.read') || hasPermission('quotes.read')) return 'rep';
    return 'unauthorized';
  }, [normalizedRole, hasPermission]);

  const pageTitle = useMemo(() => {
    if (mode === 'manager') return 'داشبورد مدیر فروش';
    if (mode === 'rep') return 'داشبورد فروشنده';
    return 'داشبورد';
  }, [mode]);

  useEffect(() => {
    if (authLoading || mode === 'unauthorized') return;
    const range = getDefaultRange();
    setError(null);
    setLoading(true);

    if (mode === 'manager') {
      Promise.all([getManagerOverview(range), getManagerTeam({ ...range, sortBy })])
        .then(([overviewRes, teamRes]) => {
          setOverview(overviewRes);
          setTeam(teamRes);
          setRepData(null);
        })
        .catch((err: unknown) => {
          setError(toDashboardError(err, 'خطا در بارگذاری داشبورد مدیر فروش.'));
        })
        .finally(() => setLoading(false));
      return;
    }

    getRepDashboard(range)
      .then((repRes) => {
        setRepData(repRes);
        setOverview(null);
        setTeam(null);
      })
      .catch((err: unknown) => {
        setError(toDashboardError(err, 'خطا در بارگذاری داشبورد کارشناس فروش.'));
      })
      .finally(() => setLoading(false));
  }, [authLoading, mode, sortBy]);

  return (
    <div className="space-y-8">
      <PageBreadcrumb current={pageTitle} />
      <h1 className="text-title-lg font-title">{pageTitle}</h1>

      {error && (
        <Card className="rounded-2xl border-rose-300">
          <CardHeader>
            <CardTitle className="text-rose-600">خطای داشبورد</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button type="button" onClick={() => window.location.reload()}>
              تلاش مجدد
            </Button>
          </CardContent>
        </Card>
      )}

      {!authLoading && mode === 'unauthorized' && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>دسترسی غیرمجاز</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">شما مجوز مشاهده داشبورد را ندارید.</p>
          </CardContent>
        </Card>
      )}

      {mode === 'manager' && !error && (
        <ManagerDashboard
          loading={authLoading || loading}
          overview={overview}
          team={team}
          sortBy={sortBy}
          onSortByChange={setSortBy}
        />
      )}

      {mode === 'rep' && !error && <RepDashboard loading={authLoading || loading} data={repData} />}
    </div>
  );
}
