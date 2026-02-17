import type { QueryResponse } from './query-types';

type Column = QueryResponse['columns'][number];

export type BarLineAreaData = {
  data: Record<string, unknown>[];
  dimensionKey: string;
  measureKeys: string[];
  legendLabels?: Record<string, string>;
};

export type PieData = {
  data: { name: string; value: number }[];
};

export type KpiData = {
  label: string;
  value: number;
};

export type ChartData = BarLineAreaData | PieData | KpiData;

export function transformForBarLine(
  rows: Record<string, unknown>[],
  columns: Column[],
): BarLineAreaData {
  const dimensionKey = columns.find((c) => c.role === 'dimension')?.name ?? '';
  const measureKeys = columns
    .filter((c) => c.role === 'measure')
    .map((c) => c.name);

  return { data: rows, dimensionKey, measureKeys };
}

export function transformForPie(
  rows: Record<string, unknown>[],
  columns: Column[],
): PieData {
  const dimensionKey = columns.find((c) => c.role === 'dimension')?.name ?? '';
  const measureKey = columns.find((c) => c.role === 'measure')?.name ?? '';

  return {
    data: rows.map((row) => ({
      name: String(row[dimensionKey] ?? ''),
      value: Number(row[measureKey] ?? 0),
    })),
  };
}

export function transformForKpi(
  rows: Record<string, unknown>[],
  columns: Column[],
): KpiData {
  const measureKey = columns.find((c) => c.role === 'measure')?.name ?? '';

  if (rows.length === 0) {
    return { label: measureKey, value: 0 };
  }

  return { label: measureKey, value: Number(rows[0][measureKey] ?? 0) };
}

export function transformChartData(
  chartType: string,
  rows: Record<string, unknown>[],
  columns: Column[],
): ChartData | null {
  switch (chartType) {
    case 'bar':
    case 'line':
    case 'area':
      return transformForBarLine(rows, columns);
    case 'pie':
      return transformForPie(rows, columns);
    case 'kpi_card':
      return transformForKpi(rows, columns);
    default:
      return null;
  }
}
