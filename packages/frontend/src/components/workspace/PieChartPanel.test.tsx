import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PieChartPanel } from './PieChartPanel';

describe('PieChartPanel', () => {
  it('renders pie slices from name/value data', () => {
    render(
      <PieChartPanel
        data={[
          { name: 'Alice', value: 500 },
          { name: 'Bob', value: 300 },
        ]}
      />,
    );

    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  });
});
