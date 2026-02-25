import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatFaNum } from '@/lib/numbers';
import { ManagerOverviewResponse } from '../types';

const COLORS = ['#64748b', '#0ea5e9', '#22c55e', '#2563eb', '#ef4444'];

type Props = {
  data: ManagerOverviewResponse['quoteStatus'];
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  SENT: 'ارسال‌شده',
  APPROVED: 'تاییدشده',
  CONVERTED: 'تبدیل به قرارداد',
  CANCELED: 'لغوشده',
  VIEWED: 'مشاهده‌شده',
  ACCEPTED: 'پذیرفته‌شده',
  SIGNED: 'امضاشده',
  INVOICED: 'تبدیل به فاکتور',
  REJECTED: 'ردشده',
  LOST: 'از دست‌رفته',
  EXPIRED: 'منقضی',
};

function getStatusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

export function QuoteDonut({ data }: Props) {
  const chartData = data.map((entry) => ({
    ...entry,
    statusLabel: getStatusLabel(entry.status),
  }));

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
        <PieChart>
          <Pie data={chartData} dataKey="count" nameKey="statusLabel" innerRadius={72} outerRadius={110}>
            {chartData.map((entry, idx) => (
              <Cell key={`${entry.status}-${idx}`} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number | string | undefined, name: number | string | undefined) => [
              formatFaNum(Number(value ?? 0)),
              String(name ?? ''),
            ]}
            contentStyle={{
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

