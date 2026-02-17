import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BarChartPanel } from './BarChartPanel';

const barProps: Record<string, unknown>[] = [];
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Bar: (props: Record<string, unknown>) => { barProps.push(props); return <div data-testid={`bar-${props.dataKey}`} />; },
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
  };
});

describe('BarChartPanel', () => {
  it('renders bars for each measure key', () => {
    render(
      <BarChartPanel
        data={[
          { month: 'Jan', revenue: 500, orders: 12 },
          { month: 'Feb', revenue: 300, orders: 8 },
        ]}
        dimensionKey="month"
        measureKeys={['revenue', 'orders']}
      />,
    );

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('uses legendLabels as name prop when provided', () => {
    barProps.length = 0;
    render(
      <BarChartPanel
        data={[
          { month: 'Jan', revenue: 500 },
          { month: 'Feb', revenue: 300 },
        ]}
        dimensionKey="month"
        measureKeys={['revenue']}
        legendLabels={{ revenue: 'Monthly Revenue' }}
      />,
    );

    const revBar = barProps.find((p) => p.dataKey === 'revenue');
    expect(revBar?.name).toBe('Monthly Revenue');
  });
});
