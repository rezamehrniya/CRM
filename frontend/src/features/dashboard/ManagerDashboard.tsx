import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TeamBars } from './charts/TeamBars';
import { RevenueTrend } from './charts/RevenueTrend';
import { ActionCenter } from './components/ActionCenter';
import { FunnelBigPicture } from './components/FunnelBigPicture';
import { HeroCards } from './components/HeroCards';
import { KPIGrid } from './components/KPIGrid';
import { CallStatusTeam } from './components/CallStatusTeam';
import { SmsTodayManager } from './components/SmsTodayManager';
import { QuoteContractPanel } from './components/QuoteContractPanel';
import { ManagerOverviewResponse, ManagerTeamResponse, TeamSortBy } from './types';

type Props = {
  loading: boolean;
  overview: ManagerOverviewResponse | null;
  team: ManagerTeamResponse | null;
  sortBy: TeamSortBy;
  onSortByChange: (value: TeamSortBy) => void;
};

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-44 w-full rounded-3xl" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, idx) => (
          <Skeleton key={idx} className="h-32 w-full rounded-3xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Skeleton className="h-[430px] w-full rounded-3xl lg:col-span-7" />
        <Skeleton className="h-[430px] w-full rounded-3xl lg:col-span-5" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Skeleton className="h-[420px] w-full rounded-3xl lg:col-span-7" />
        <Skeleton className="h-[420px] w-full rounded-3xl lg:col-span-5" />
      </div>
    </div>
  );
}

export function ManagerDashboard({ loading, overview, team, sortBy, onSortByChange }: Props) {
  const navigate = useNavigate();

  if (loading || !overview || !team) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
      <HeroCards hero={overview.hero} />
      <KPIGrid kpis={overview.kpis} />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <FunnelBigPicture
            stages={overview.funnelStages}
            onStageClick={(stageKey) => navigate(`../leads?stage=${stageKey}`)}
          />
        </div>
        <Card className="rounded-3xl border-slate-200/70 lg:col-span-5">
          <CardHeader className="space-y-2 pb-1">
            <CardTitle>روند درآمد</CardTitle>
            <p className="text-xs text-muted-foreground">مقایسه فروش واقعی با تارگت در بازه انتخابی</p>
          </CardHeader>
          <CardContent className="pt-2">
            <RevenueTrend data={overview.revenueTrend} />
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="rounded-3xl border-slate-200/70 lg:col-span-7">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle>عملکرد تیم فروش</CardTitle>
            <select
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={sortBy}
              onChange={(event) => onSortByChange(event.target.value as TeamSortBy)}
            >
              <option value="revenue">مرتب‌سازی براساس درآمد</option>
              <option value="conversion">مرتب‌سازی براساس نرخ تبدیل</option>
              <option value="overdue">مرتب‌سازی براساس معوق</option>
            </select>
          </CardHeader>
          <CardContent className="space-y-4">
            <TeamBars rows={team.rows} />
            <div className="flex flex-wrap gap-2">
              {team.rows.map((row) => (
                <button
                  key={row.userId}
                  type="button"
                  onClick={() => navigate(`../leads?owner=${row.userId}`)}
                  className="rounded-full border border-border bg-background px-3 py-1 text-xs transition hover:bg-muted/60"
                >
                  {row.name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-200/70 lg:col-span-5">
          <CardHeader className="space-y-2 pb-1">
            <CardTitle>وضعیت پیش‌فاکتور تا فاکتور</CardTitle>
            <p className="text-xs text-muted-foreground">نمای کلی جریان تبدیل و قرارداد</p>
          </CardHeader>
          <CardContent className="pt-2">
            <QuoteContractPanel
              overview={overview}
              onOpenQuotes={() => navigate('../quotes')}
              onOpenStage={(stageKey) => navigate(`../leads?stage=${stageKey}`)}
            />
          </CardContent>
        </Card>
      </section>

      <SmsTodayManager data={overview.smsToday} />
      <CallStatusTeam />
      <ActionCenter data={overview.actionCenter} />
    </div>
  );
}

