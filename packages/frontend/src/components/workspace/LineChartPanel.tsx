import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { CHART_COLORS } from '../../domain/chart-colors';
import type { BarLineAreaData } from '../../domain/chart-transforms';

export function LineChartPanel({ data, dimensionKey, measureKeys, legendLabels }: BarLineAreaData) {
  return (
    <div data-testid="line-chart" className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={dimensionKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          {measureKeys.map((key, index) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={legendLabels?.[key] ?? key}
              stroke={CHART_COLORS[index % CHART_COLORS.length]}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
