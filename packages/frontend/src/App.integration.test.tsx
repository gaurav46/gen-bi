import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

const mockQueryResponse = {
  intent: 'top_customers',
  title: 'Top Customers by Revenue',
  sql: 'SELECT name, SUM(total) FROM customers GROUP BY name ORDER BY SUM(total) DESC LIMIT 10',
  visualization: { chartType: 'bar' },
  columns: [
    { name: 'name', type: 'varchar', role: 'dimension' },
    { name: 'total', type: 'numeric', role: 'measure' },
  ],
  rows: [
    { name: 'Alice', total: 12500 },
    { name: 'Bob', total: 8200 },
  ],
  attempts: 1,
};

const mockTables = [
  {
    id: 't1', connectionId: 'conn-1', schemaName: 'public', tableName: 'users',
    columns: [
      { columnName: 'id', dataType: 'int4', isNullable: false, ordinalPosition: 1 },
      { columnName: 'email', dataType: 'varchar', isNullable: false, ordinalPosition: 2 },
      { columnName: 'name', dataType: 'varchar', isNullable: true, ordinalPosition: 3 },
    ],
    foreignKeys: [],
    indexes: [{ indexName: 'users_pkey', columnName: 'id', isUnique: true }],
  },
  {
    id: 't2', connectionId: 'conn-1', schemaName: 'public', tableName: 'orders',
    columns: [
      { columnName: 'id', dataType: 'int4', isNullable: false, ordinalPosition: 1 },
      { columnName: 'user_id', dataType: 'int4', isNullable: false, ordinalPosition: 2 },
      { columnName: 'total', dataType: 'numeric', isNullable: true, ordinalPosition: 3 },
    ],
    foreignKeys: [{ columnName: 'user_id', foreignTableSchema: 'public', foreignTableName: 'users', foreignColumnName: 'id', constraintName: 'orders_user_id_fkey' }],
    indexes: [{ indexName: 'orders_pkey', columnName: 'id', isUnique: true }],
  },
];

describe('App Integration', () => {
  beforeEach(() => {
    localStorage.setItem('connectionId', 'conn-1');
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/schema/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTables) });
      }
      if (url.includes('/api/connections/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'conn-1', host: 'localhost' }) });
      }
      if (url === '/api/query') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockQueryResponse) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));
  });

  it('user browses schema explorer: sees tables, searches, views column detail', async () => {
    render(<App />);

    expect(screen.getByText('Schema Explorer')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('users')).toBeInTheDocument();
    });
    expect(screen.getByText('orders')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Search tables...');
    await userEvent.type(searchInput, 'orders');

    await waitFor(() => {
      expect(screen.queryByText('users')).not.toBeInTheDocument();
    });
    expect(screen.getByText('orders')).toBeInTheDocument();

    await userEvent.click(screen.getByText('orders'));

    expect(screen.getByText('user_id')).toBeInTheDocument();
    expect(screen.getByText('numeric')).toBeInTheDocument();
    expect(screen.getByText('users.id')).toBeInTheDocument();
    expect(screen.getByText('PK')).toBeInTheDocument();
  });

  it('user navigates to Workspace, types a question, sees results table', async () => {
    render(<App />);

    await userEvent.click(screen.getByText('Workspace'));

    const input = screen.getByPlaceholderText('Ask a question...');
    await userEvent.type(input, 'Show top customers');
    await userEvent.click(screen.getByRole('button', { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByText('Top Customers by Revenue')).toBeInTheDocument();
    });
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('12500')).toBeInTheDocument();
  });
});
