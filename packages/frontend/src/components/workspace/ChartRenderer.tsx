import type { QueryResponse } from '../../domain/query-types';
import { transformChartData } from '../../domain/chart-transforms';
import type { BarLineAreaData, PieData, KpiData } from '../../domain/chart-transforms';
import { BarChartPanel } from './BarChartPanel';
import { LineChartPanel } from './LineChartPanel';
import { AreaChartPanel } from './AreaChartPanel';
import { PieChartPanel } from './PieChartPanel';
import { KpiCardPanel } from './KpiCardPanel';

type ChartRendererProps = {
  chartType: string;
  columns: QueryResponse['columns'];
  rows: QueryResponse['rows'];
  legendLabels?: Record<string, string>;
};

export function ChartRenderer({ chartType, columns, rows, legendLabels }: ChartRendererProps) {
  const chartData = transformChartData(chartType, rows, columns);
  if (!chartData) return null;

  switch (chartType) {
    case 'bar':
      return <BarChartPanel {...(chartData as BarLineAreaData)} legendLabels={legendLabels} />;
    case 'line':
      return <LineChartPanel {...(chartData as BarLineAreaData)} legendLabels={legendLabels} />;
    case 'area':
      return <AreaChartPanel {...(chartData as BarLineAreaData)} legendLabels={legendLabels} />;
    case 'pie':
      return <PieChartPanel {...(chartData as PieData)} />;
    case 'kpi_card':
      return <KpiCardPanel {...(chartData as KpiData)} />;
    default:
      return null;
  }
}
