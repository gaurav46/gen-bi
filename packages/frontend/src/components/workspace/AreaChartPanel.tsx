import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { CHART_COLORS } from '../../domain/chart-colors';
import type { BarLineAreaData } from '../../domain/chart-transforms';

export function AreaChartPanel({ data, dimensionKey, measureKeys, legendLabels }: BarLineAreaData) {
  return (
    <div data-testid="area-chart" className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={dimensionKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          {measureKeys.map((key, index) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              name={legendLabels?.[key] ?? key}
              stackId="1"
              fill={CHART_COLORS[index % CHART_COLORS.length]}
              stroke={CHART_COLORS[index % CHART_COLORS.length]}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
