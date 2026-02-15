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
  return { fetchTables: vi.fn().mockResolvedValue(result) };
}

function createFailingPort(error: string): SchemaDataPort {
  return { fetchTables: vi.fn().mockRejectedValue(new Error(error)) };
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
    const port: SchemaDataPort = { fetchTables: () => new Promise(() => {}) };
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
});
