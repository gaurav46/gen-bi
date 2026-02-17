import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AreaChartPanel } from './AreaChartPanel';

describe('AreaChartPanel', () => {
  it('renders stacked areas for each measure key', () => {
    render(
      <AreaChartPanel
        data={[
          { month: 'Jan', revenue: 500, orders: 12 },
          { month: 'Feb', revenue: 300, orders: 8 },
        ]}
        dimensionKey="month"
        measureKeys={['revenue', 'orders']}
      />,
    );

    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
  });
});
