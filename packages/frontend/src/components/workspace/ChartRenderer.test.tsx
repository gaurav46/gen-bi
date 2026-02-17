import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartRenderer } from './ChartRenderer';

const columns = [
  { name: 'month', type: 'varchar', role: 'dimension' as const },
  { name: 'revenue', type: 'numeric', role: 'measure' as const },
];

const rows = [
  { month: 'Jan', revenue: 500 },
  { month: 'Feb', revenue: 300 },
];

describe('ChartRenderer', () => {
  it('renders BarChartPanel for chartType bar', () => {
    render(<ChartRenderer chartType="bar" columns={columns} rows={rows} />);
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('renders LineChartPanel for chartType line', () => {
    render(<ChartRenderer chartType="line" columns={columns} rows={rows} />);
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('renders AreaChartPanel for chartType area', () => {
    render(<ChartRenderer chartType="area" columns={columns} rows={rows} />);
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
  });

  it('renders PieChartPanel for chartType pie', () => {
    render(<ChartRenderer chartType="pie" columns={columns} rows={rows} />);
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  });

  it('renders KpiCardPanel for chartType kpi_card', () => {
    const kpiColumns = [
      { name: 'total_revenue', type: 'numeric', role: 'measure' as const },
    ];
    const kpiRows = [{ total_revenue: 125000 }];

    render(<ChartRenderer chartType="kpi_card" columns={kpiColumns} rows={kpiRows} />);
    expect(screen.getByTestId('kpi-card')).toBeInTheDocument();
  });

  it('returns null for chartType table', () => {
    const { container } = render(<ChartRenderer chartType="table" columns={columns} rows={rows} />);
    expect(container.innerHTML).toBe('');
  });
});
