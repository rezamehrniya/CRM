import { Skeleton } from '@/components/ui/skeleton';
import { MyFunnelMini } from './components/MyFunnelMini';
import { MyTargetCard } from './components/MyTargetCard';
import { MyCallsToday } from './components/MyCallsToday';
import { MySmsToday } from './components/MySmsToday';
import { RemindersList } from './components/RemindersList';
import { TodayStrip } from './components/TodayStrip';
import { RepDashboardResponse } from './types';

type Props = {
  loading: boolean;
  data: RepDashboardResponse | null;
};

function RepDashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Skeleton key={idx} className="h-36 w-full rounded-3xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Skeleton className="h-[520px] w-full rounded-3xl lg:col-span-8" />
        <Skeleton className="h-[520px] w-full rounded-3xl lg:col-span-4" />
      </div>
      <Skeleton className="h-[360px] w-full rounded-3xl" />
    </div>
  );
}

export function RepDashboard({ loading, data }: Props) {
  if (loading || !data) {
    return <RepDashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
      <TodayStrip today={data.today} />
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <RemindersList reminders={data.reminders} />
        </div>
        <div className="lg:col-span-4">
          <MyTargetCard target={data.myTarget} />
        </div>
      </section>
      <MySmsToday data={data.smsToday} />
      <MyCallsToday />
      <MyFunnelMini stages={data.myFunnel} />
    </div>
  );
}
