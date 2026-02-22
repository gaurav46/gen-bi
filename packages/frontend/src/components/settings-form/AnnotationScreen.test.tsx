import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AnnotationScreen } from './AnnotationScreen';

describe('AnnotationScreen', () => {
  it('renders ambiguous columns grouped by table with editable descriptions', () => {
    const columns = [
      {
        columnId: 'col-1',
        tableName: 'orders',
        schemaName: 'public',
        columnName: 'amt_1',
        dataType: 'numeric',
        suggestedDescription: 'Order subtotal amount',
      },
    ];

    render(
      <AnnotationScreen
        columns={columns}
        onContinue={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    expect(screen.getByText('orders')).toBeInTheDocument();
    expect(screen.getByText('amt_1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Order subtotal amount')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
  });

  it('shows empty input when suggestedDescription is null', () => {
    const columns = [
      {
        columnId: 'col-2',
        tableName: 'users',
        schemaName: 'public',
        columnName: 'flg_yn',
        dataType: 'boolean',
        suggestedDescription: null,
      },
    ];

    render(
      <AnnotationScreen
        columns={columns}
        onContinue={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    const input = screen.getByLabelText('Description for flg_yn') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('user can edit description and Continue sends updated values', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    const columns = [
      {
        columnId: 'col-1',
        tableName: 'orders',
        schemaName: 'public',
        columnName: 'amt_1',
        dataType: 'numeric',
        suggestedDescription: 'Order subtotal amount',
      },
    ];

    render(
      <AnnotationScreen
        columns={columns}
        onContinue={onContinue}
        onSkip={vi.fn()}
      />,
    );

    const input = screen.getByLabelText('Description for amt_1');
    await user.clear(input);
    await user.type(input, 'Net order amount');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(onContinue).toHaveBeenCalledWith([
      { columnId: 'col-1', description: 'Net order amount' },
    ]);
  });
});
