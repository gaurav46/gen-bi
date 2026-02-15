import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResultsTable } from './ResultsTable';

const columns = [
  { name: 'name', type: 'varchar', role: 'dimension' as const },
  { name: 'revenue', type: 'numeric', role: 'measure' as const },
];

const rows = [
  { name: 'Alice', revenue: 12500 },
  { name: 'Bob', revenue: null },
];

describe('ResultsTable', () => {
  it('renders table headers from column metadata', () => {
    render(<ResultsTable columns={columns} rows={rows} />);

    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('revenue')).toBeInTheDocument();
  });

  it('right-aligns numeric columns', () => {
    render(<ResultsTable columns={columns} rows={rows} />);

    const revenueHeader = screen.getByText('revenue');
    expect(revenueHeader.className).toContain('text-right');

    const revenueCells = screen.getAllByText('12500');
    expect(revenueCells[0].closest('td')?.className).toContain('text-right');
  });

  it('renders null values with muted italic styling', () => {
    render(<ResultsTable columns={columns} rows={rows} />);

    const nullCell = screen.getByText('null');
    expect(nullCell.className).toContain('text-muted-foreground');
    expect(nullCell.className).toContain('italic');
  });

  it('shows "No results" when rows is empty', () => {
    render(<ResultsTable columns={columns} rows={[]} />);

    expect(screen.getByText(/no results/i)).toBeInTheDocument();
  });
});
