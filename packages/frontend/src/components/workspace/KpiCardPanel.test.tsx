import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiCardPanel } from './KpiCardPanel';

describe('KpiCardPanel', () => {
  it('renders KPI value prominently with label', () => {
    render(<KpiCardPanel label="Total Revenue" value={125000} />);

    expect(screen.getByText('125,000')).toBeInTheDocument();
    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
  });

  it('has kpi-card data-testid', () => {
    render(<KpiCardPanel label="Total Revenue" value={125000} />);

    expect(screen.getByTestId('kpi-card')).toBeInTheDocument();
  });
});
