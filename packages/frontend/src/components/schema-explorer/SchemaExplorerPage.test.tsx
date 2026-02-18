import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SchemaExplorerPage } from './SchemaExplorerPage';
import type { SchemaDataPort } from '../../ports/schema-data-port';
import type { DiscoveredTable } from '../../domain/schema-types';

const tables: DiscoveredTable[] = [
  {
    id: 't1', connectionId: 'conn-1', schemaName: 'public', tableName: 'users',
    columns: [
      { columnName: 'id', dataType: 'int4', isNullable: false, ordinalPosition: 1 },
      { columnName: 'email', dataType: 'varchar', isNullable: false, ordinalPosition: 2 },
    ],
    foreignKeys: [],
    indexes: [{ indexName: 'users_pkey', columnName: 'id', isUnique: true }],
  },
  {
    id: 't2', connectionId: 'conn-1', schemaName: 'public', tableName: 'orders',
    columns: [
      { columnName: 'id', dataType: 'int4', isNullable: false, ordinalPosition: 1 },
      { columnName: 'user_id', dataType: 'int4', isNullable: false, ordinalPosition: 2 },
    ],
    foreignKeys: [{ columnName: 'user_id', foreignTableSchema: 'public', foreignTableName: 'users', foreignColumnName: 'id', constraintName: 'fk_user' }],
    indexes: [{ indexName: 'orders_pkey', columnName: 'id', isUnique: true }],
  },
];

function createMockPort(result: DiscoveredTable[] = tables): SchemaDataPort {
  return { fetchTables: vi.fn().mockResolvedValue(result), fetchTableRows: vi.fn().mockResolvedValue({ rows: [], totalRows: 0, page: 1, pageSize: 25, primaryKeyColumns: [] }) };
}

function createFailingPort(error: string): SchemaDataPort {
  return { fetchTables: vi.fn().mockRejectedValue(new Error(error)), fetchTableRows: vi.fn() };
}

describe('SchemaExplorerPage', () => {
  beforeEach(() => {
    localStorage.setItem('connectionId', 'conn-1');
  });

  it('renders table list and detail panel side by side', async () => {
    render(<SchemaExplorerPage port={createMockPort()} />);

    await waitFor(() => {
      expect(screen.getByText('users')).toBeInTheDocument();
    });
    expect(screen.getByText('orders')).toBeInTheDocument();

    await userEvent.click(screen.getByText('users'));
    expect(screen.getByText('email')).toBeInTheDocument();
  });

  it('shows Skeleton loading state while fetching tables', () => {
    const port: SchemaDataPort = { fetchTables: () => new Promise(() => {}), fetchTableRows: vi.fn() };
    render(<SchemaExplorerPage port={port} />);

    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows error message when fetch fails', async () => {
    render(<SchemaExplorerPage port={createFailingPort('Network error')} />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows empty state when no tables exist', async () => {
    render(<SchemaExplorerPage port={createMockPort([])} />);

    await waitFor(() => {
      expect(screen.getByText('No tables discovered. Run analysis in Settings first.')).toBeInTheDocument();
    });
  });

  it('shows prompt to connect when no connectionId in localStorage', () => {
    localStorage.removeItem('connectionId');
    render(<SchemaExplorerPage port={createMockPort()} />);

    expect(screen.getByText('Connect a database first in Settings.')).toBeInTheDocument();
  });

  it('shows retry action when fetch fails', async () => {
    const port = createFailingPort('Server error');
    render(<SchemaExplorerPage port={port} />);

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('shows data preview grid below column details when table is selected', async () => {
    const port: SchemaDataPort = {
      fetchTables: vi.fn().mockResolvedValue(tables),
      fetchTableRows: vi.fn().mockResolvedValue({
        rows: [{ id: 1, email: 'alice@example.com' }, { id: 2, email: 'bob@example.com' }],
        totalRows: 2,
        page: 1,
        pageSize: 25,
        primaryKeyColumns: ['id'],
      }),
    };
    render(<SchemaExplorerPage port={port} />);

    await waitFor(() => {
      expect(screen.getByText('users')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('users'));

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    expect(screen.getByText('2 rows')).toBeInTheDocument();
  });
});
