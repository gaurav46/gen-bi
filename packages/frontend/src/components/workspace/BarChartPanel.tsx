import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { CHART_COLORS } from '../../domain/chart-colors';
import type { BarLineAreaData } from '../../domain/chart-transforms';

export function BarChartPanel({ data, dimensionKey, measureKeys, legendLabels }: BarLineAreaData) {
  return (
    <div data-testid="bar-chart" className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={dimensionKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          {measureKeys.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              name={legendLabels?.[key] ?? key}
              fill={CHART_COLORS[index % CHART_COLORS.length]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
