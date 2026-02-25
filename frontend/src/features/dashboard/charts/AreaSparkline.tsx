import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import { SparkPoint } from '../types';

type Props = {
  data: SparkPoint[];
};

export function AreaSparkline({ data }: Props) {
  return (
    <div className="h-16 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
        <AreaChart data={data}>
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 12,
            }}
          />
          <Area type="monotone" dataKey="y" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.25} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
