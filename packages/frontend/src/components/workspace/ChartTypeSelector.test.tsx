import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChartTypeSelector } from './ChartTypeSelector';

describe('ChartTypeSelector', () => {
  it('renders a button for each chart type', () => {
    render(<ChartTypeSelector selected="bar" onSelect={vi.fn()} />);

    expect(screen.getByTestId('chart-type-selector')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Line' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Area' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pie' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'KPI Card' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Table' })).toBeInTheDocument();
  });

  it('selected chart type button has aria-pressed true', () => {
    render(<ChartTypeSelector selected="pie" onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Pie' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Bar' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking a chart type button calls onSelect with its value', async () => {
    const onSelect = vi.fn();
    render(<ChartTypeSelector selected="bar" onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: 'Line' }));

    expect(onSelect).toHaveBeenCalledWith('line');
  });

  it('selected button has primary styling, others have secondary', () => {
    render(<ChartTypeSelector selected="area" onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Area' }).className).toContain('bg-primary');
    expect(screen.getByRole('button', { name: 'Bar' }).className).not.toContain('bg-primary');
  });
});
