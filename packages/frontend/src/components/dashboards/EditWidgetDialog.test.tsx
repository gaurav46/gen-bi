import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditWidgetDialog } from './EditWidgetDialog';
import type { Widget } from '../../domain/dashboard-types';

function createWidget(overrides: Partial<Widget> = {}): Widget {
  return {
    id: 'w1',
    dashboardId: 'd1',
    title: 'Revenue',
    sql: 'SELECT 1',
    chartType: 'bar',
    columns: [
      { name: 'month', type: 'varchar', role: 'dimension' },
      { name: 'revenue', type: 'numeric', role: 'measure' },
      { name: 'orders', type: 'numeric', role: 'measure' },
    ],
    position: 0,
    createdAt: '2025-01-01',
    ...overrides,
  };
}

describe('EditWidgetDialog', () => {
  it('save button calls onSave with updated title and legendLabels', async () => {
    const onSave = vi.fn();
    const widget = createWidget();

    render(
      <EditWidgetDialog
        widget={widget}
        open={true}
        onOpenChange={vi.fn()}
        onSave={onSave}
      />,
    );

    const titleInput = screen.getByDisplayValue('Revenue');
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Monthly Revenue');

    const revenueLabel = screen.getByDisplayValue('revenue');
    await userEvent.clear(revenueLabel);
    await userEvent.type(revenueLabel, 'Rev');

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(onSave).toHaveBeenCalledWith({
      title: 'Monthly Revenue',
      legendLabels: { revenue: 'Rev', orders: 'orders' },
    });
  });

  it('cancel button closes dialog without calling onSave', async () => {
    const onSave = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <EditWidgetDialog
        widget={createWidget()}
        open={true}
        onOpenChange={onOpenChange}
        onSave={onSave}
      />,
    );

    const titleInput = screen.getByDisplayValue('Revenue');
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Changed');

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
