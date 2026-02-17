export type ChartTypeValue = 'bar' | 'line' | 'area' | 'pie' | 'kpi_card' | 'table';

export const CHART_TYPES: readonly { value: ChartTypeValue; label: string }[] = [
  { value: 'bar', label: 'Bar' },
  { value: 'line', label: 'Line' },
  { value: 'area', label: 'Area' },
  { value: 'pie', label: 'Pie' },
  { value: 'kpi_card', label: 'KPI Card' },
  { value: 'table', label: 'Table' },
];
