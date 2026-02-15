import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TableListPanel } from './TableListPanel';
import type { DiscoveredTable } from '../../domain/schema-types';

const tables: DiscoveredTable[] = [
  { id: 't1', connectionId: 'c1', schemaName: 'public', tableName: 'users', columns: [], foreignKeys: [], indexes: [] },
  { id: 't2', connectionId: 'c1', schemaName: 'public', tableName: 'orders', columns: [], foreignKeys: [], indexes: [] },
];

describe('TableListPanel', () => {
  it('renders table names from provided list', () => {
    render(<TableListPanel tables={tables} selectedTableId={null} onSelect={vi.fn()} searchTerm="" onSearchChange={vi.fn()} />);
    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.getByText('orders')).toBeInTheDocument();
  });

  it('calls onSelect when a table is clicked', async () => {
    const onSelect = vi.fn();
    render(<TableListPanel tables={tables} selectedTableId={null} onSelect={onSelect} searchTerm="" onSearchChange={vi.fn()} />);

    await userEvent.click(screen.getByText('users'));

    expect(onSelect).toHaveBeenCalledWith(tables[0]);
  });

  it('renders search input that calls onSearchChange', async () => {
    const onSearchChange = vi.fn();
    render(<TableListPanel tables={tables} selectedTableId={null} onSelect={vi.fn()} searchTerm="" onSearchChange={onSearchChange} />);

    await userEvent.type(screen.getByPlaceholderText('Search tables...'), 'user');

    expect(onSearchChange).toHaveBeenCalled();
  });

  it('highlights the selected table', () => {
    render(<TableListPanel tables={tables} selectedTableId="t1" onSelect={vi.fn()} searchTerm="" onSearchChange={vi.fn()} />);

    const selectedItem = screen.getByRole('option', { selected: true });
    expect(selectedItem.textContent).toBe('users');
  });

  it('shows no results message when search matches nothing', () => {
    render(<TableListPanel tables={[]} selectedTableId={null} onSelect={vi.fn()} searchTerm="xyz" onSearchChange={vi.fn()} />);
    expect(screen.getByText('No tables match your search')).toBeInTheDocument();
  });

  it('supports keyboard navigation through table list', async () => {
    const onSelect = vi.fn();
    render(<TableListPanel tables={tables} selectedTableId={null} onSelect={onSelect} searchTerm="" onSearchChange={vi.fn()} />);

    const firstItem = screen.getByText('users');
    firstItem.focus();

    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement?.textContent).toBe('orders');

    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(tables[1]);
  });

  it('renders 100+ tables without issues', () => {
    const manyTables = Array.from({ length: 120 }, (_, i) => ({
      id: `t${i}`, connectionId: 'c1', schemaName: 'public', tableName: `table_${i}`,
      columns: [], foreignKeys: [], indexes: [],
    }));
    render(<TableListPanel tables={manyTables} selectedTableId={null} onSelect={vi.fn()} searchTerm="" onSearchChange={vi.fn()} />);
    expect(screen.getByText('table_0')).toBeInTheDocument();
    expect(screen.getByText('table_119')).toBeInTheDocument();
  });
});
