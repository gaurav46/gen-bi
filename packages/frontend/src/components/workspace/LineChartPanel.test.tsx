import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LineChartPanel } from './LineChartPanel';

describe('LineChartPanel', () => {
  it('renders line for each measure key', () => {
    render(
      <LineChartPanel
        data={[
          { month: 'Jan', revenue: 500 },
          { month: 'Feb', revenue: 300 },
        ]}
        dimensionKey="month"
        measureKeys={['revenue']}
      />,
    );

    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });
});
