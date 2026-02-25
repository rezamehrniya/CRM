import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatJalali } from '@/lib/date';
import { formatFaCurrency, formatFaNum } from '@/lib/numbers';
import { ManagerOverviewResponse } from '../types';

type Props = {
  data: ManagerOverviewResponse['revenueTrend'];
};

function formatMoneyTick(value: number) {
  const rialValue = value * 10;
  const abs = Math.abs(rialValue);
  if (abs >= 1_000_000_000) return `${formatFaNum((rialValue / 1_000_000_000).toFixed(1))} میلیارد`;
  if (abs >= 1_000_000) return `${formatFaNum((rialValue / 1_000_000).toFixed(1))} میلیون`;
  if (abs >= 1_000) return `${formatFaNum((rialValue / 1_000).toFixed(0))} هزار`;
  return formatFaNum(Math.round(rialValue));
}

function formatRial(value: number) {
  return formatFaCurrency(value, { sourceUnit: 'TOMAN', outputUnit: 'RIAL', showUnit: true });
}

function RevenueTooltip(props: any) {
  const { active, payload } = props ?? {};
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;
  const point = payload[0]?.payload as { bucket?: string; actual?: number; target?: number } | undefined;
  if (!point) return null;

  const actual = Number(point.actual ?? 0);
  const target = Number(point.target ?? 0);
  const variance = actual - target;
  const varianceClass = variance < 0 ? 'text-rose-600' : variance > 0 ? 'text-emerald-600' : 'text-slate-600';

  return (
    <div className="min-w-[210px] rounded-xl border border-border bg-popover p-3 text-xs shadow-xl">
      <p className="text-muted-foreground">تاریخ: {formatJalali(point.bucket ?? '', { dateOnly: true })}</p>
      <div className="mt-2 space-y-1">
        <p className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">واقعی</span>
          <span className="fa-num font-semibold">{formatRial(actual)}</span>
        </p>
        <p className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">هدف</span>
          <span className="fa-num font-semibold">{formatRial(target)}</span>
        </p>
        <p className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">اختلاف</span>
          <span className={`fa-num font-semibold ${varianceClass}`}>
            {variance > 0 ? '+' : ''}
            {formatRial(variance)}
          </span>
        </p>
      </div>
    </div>
  );
}

export function RevenueTrend({ data }: Props) {
  return (
    <div className="h-[340px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
        <AreaChart data={data} margin={{ top: 14, right: 18, left: 8, bottom: 6 }}>
          <defs>
            <linearGradient id="revenueActualFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#2563eb" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 6" stroke="hsl(var(--border))" opacity={0.28} vertical={false} />
          <XAxis
            dataKey="bucket"
            tick={{ fontSize: 11 }}
            tickMargin={8}
            minTickGap={18}
            tickFormatter={(value) => formatJalali(String(value), { dateOnly: true })}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            width={76}
            tickFormatter={(value) => formatMoneyTick(Number(value))}
          />
          <Tooltip content={<RevenueTooltip />} cursor={{ stroke: '#1d4ed8', strokeOpacity: 0.25, strokeDasharray: '4 4' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="actual"
            name="واقعی"
            stroke="#2563eb"
            fill="url(#revenueActualFill)"
            strokeWidth={3}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="target"
            name="هدف"
            stroke="#0ea5e9"
            strokeWidth={2}
            strokeDasharray="8 6"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
