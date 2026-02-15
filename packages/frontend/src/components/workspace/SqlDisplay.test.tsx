import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SqlDisplay } from './SqlDisplay';

describe('SqlDisplay', () => {
  it('shows SQL in monospace font with a toggle trigger', () => {
    render(<SqlDisplay sql="SELECT * FROM orders" />);

    expect(screen.getByText(/view generated sql/i)).toBeInTheDocument();
  });

  it('toggles SQL visibility when trigger is clicked', async () => {
    render(<SqlDisplay sql="SELECT * FROM orders" />);

    const trigger = screen.getByText(/view generated sql/i);
    await userEvent.click(trigger);

    const sqlBlock = screen.getByText('SELECT * FROM orders');
    expect(sqlBlock).toBeInTheDocument();
    expect(sqlBlock.className).toContain('font-mono');
    expect(sqlBlock.className).toContain('text-xs');
  });
});
