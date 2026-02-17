import { describe, it, expect } from 'vitest';
import {
  transformForBarLine,
  transformForPie,
  transformForKpi,
  transformChartData,
} from './chart-transforms';

const dimensionColumn = { name: 'month', type: 'varchar', role: 'dimension' as const };
const revenueColumn = { name: 'revenue', type: 'numeric', role: 'measure' as const };
const ordersColumn = { name: 'orders', type: 'integer', role: 'measure' as const };

describe('transformForBarLine', () => {
  it('transforms rows into bar/line/area format with single measure', () => {
    const rows = [
      { month: 'Jan', revenue: 500 },
      { month: 'Feb', revenue: 300 },
    ];
    const columns = [dimensionColumn, revenueColumn];

    const result = transformForBarLine(rows, columns);

    expect(result).toEqual({
      data: rows,
      dimensionKey: 'month',
      measureKeys: ['revenue'],
    });
  });

  it('includes multiple measure keys when multiple measures exist', () => {
    const rows = [
      { month: 'Jan', revenue: 500, orders: 12 },
      { month: 'Feb', revenue: 300, orders: 8 },
    ];
    const columns = [dimensionColumn, revenueColumn, ordersColumn];

    const result = transformForBarLine(rows, columns);

    expect(result.measureKeys).toEqual(['revenue', 'orders']);
    expect(result.data[0]).toEqual({ month: 'Jan', revenue: 500, orders: 12 });
  });

  it('returns empty data array for empty rows', () => {
    const columns = [dimensionColumn, revenueColumn];

    const result = transformForBarLine([], columns);

    expect(result).toEqual({
      data: [],
      dimensionKey: 'month',
      measureKeys: ['revenue'],
    });
  });
});

describe('transformForPie', () => {
  it('transforms rows into pie format using first dimension and first measure', () => {
    const rows = [
      { month: 'Jan', revenue: 500 },
      { month: 'Feb', revenue: 300 },
    ];
    const columns = [dimensionColumn, revenueColumn];

    const result = transformForPie(rows, columns);

    expect(result).toEqual({
      data: [
        { name: 'Jan', value: 500 },
        { name: 'Feb', value: 300 },
      ],
    });
  });

  it('uses only first measure when multiple measures exist', () => {
    const rows = [
      { month: 'Jan', revenue: 500, orders: 12 },
      { month: 'Feb', revenue: 300, orders: 8 },
    ];
    const columns = [dimensionColumn, revenueColumn, ordersColumn];

    const result = transformForPie(rows, columns);

    expect(result.data[0].value).toBe(500);
    expect(result.data[1].value).toBe(300);
  });

  it('returns empty data array for empty rows', () => {
    const columns = [dimensionColumn, revenueColumn];

    const result = transformForPie([], columns);

    expect(result).toEqual({ data: [] });
  });
});

describe('transformForKpi', () => {
  const measureColumn = { name: 'total_revenue', type: 'numeric', role: 'measure' as const };

  it('extracts single measure value and label', () => {
    const rows = [{ total_revenue: 125000 }];
    const columns = [measureColumn];

    const result = transformForKpi(rows, columns);

    expect(result).toEqual({ label: 'total_revenue', value: 125000 });
  });

  it('uses first row when multiple rows exist', () => {
    const rows = [{ total_revenue: 125000 }, { total_revenue: 98000 }];
    const columns = [measureColumn];

    const result = transformForKpi(rows, columns);

    expect(result.value).toBe(125000);
  });

  it('returns zero for empty rows', () => {
    const rows: Record<string, unknown>[] = [];
    const columns = [measureColumn];

    const result = transformForKpi(rows, columns);

    expect(result).toEqual({ label: 'total_revenue', value: 0 });
  });
});

describe('transformChartData', () => {
  const rows = [{ month: 'Jan', revenue: 500 }];
  const columns = [dimensionColumn, revenueColumn];

  it('returns BarLineAreaData for bar, line, area chart types', () => {
    for (const chartType of ['bar', 'line', 'area']) {
      const result = transformChartData(chartType, rows, columns);
      expect(result).toHaveProperty('dimensionKey');
      expect(result).toHaveProperty('measureKeys');
    }
  });

  it('returns PieData for pie chart type', () => {
    const result = transformChartData('pie', rows, columns);
    expect(result).toHaveProperty('data');
    expect((result as { data: { name: string }[] }).data[0]).toHaveProperty('name');
    expect((result as { data: { value: number }[] }).data[0]).toHaveProperty('value');
  });

  it('returns KpiData for kpi_card chart type', () => {
    const kpiRows = [{ total_revenue: 125000 }];
    const kpiColumns = [{ name: 'total_revenue', type: 'numeric', role: 'measure' as const }];

    const result = transformChartData('kpi_card', kpiRows, kpiColumns);

    expect(result).toHaveProperty('label');
    expect(result).toHaveProperty('value');
  });

  it('returns null for table chart type', () => {
    const result = transformChartData('table', rows, columns);
    expect(result).toBeNull();
  });
});
