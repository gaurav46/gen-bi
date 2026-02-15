import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ColumnDetailPanel } from './ColumnDetailPanel';
import type { DiscoveredTable } from '../../domain/schema-types';

const table: DiscoveredTable = {
  id: 't1', connectionId: 'c1', schemaName: 'public', tableName: 'orders',
  columns: [
    { columnName: 'id', dataType: 'int4', isNullable: false, ordinalPosition: 1 },
    { columnName: 'user_id', dataType: 'int4', isNullable: false, ordinalPosition: 2 },
    { columnName: 'notes', dataType: 'text', isNullable: true, ordinalPosition: 3 },
  ],
  foreignKeys: [
    { columnName: 'user_id', foreignTableSchema: 'public', foreignTableName: 'users', foreignColumnName: 'id', constraintName: 'fk_user' },
  ],
  indexes: [
    { indexName: 'orders_pkey', columnName: 'id', isUnique: true },
  ],
};

describe('ColumnDetailPanel', () => {
  it('renders column names and data types', () => {
    render(<ColumnDetailPanel table={table} />);
    expect(screen.getByText('id')).toBeInTheDocument();
    expect(screen.getAllByText('int4').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('user_id')).toBeInTheDocument();
    expect(screen.getByText('notes')).toBeInTheDocument();
    expect(screen.getByText('text')).toBeInTheDocument();
  });

  it('shows nullable flag for nullable columns', () => {
    render(<ColumnDetailPanel table={table} />);
    const rows = screen.getAllByRole('row');
    const notesRow = rows.find((r) => r.textContent?.includes('notes'));
    expect(notesRow?.textContent).toContain('YES');
  });

  it('shows FK indicator with target table reference', () => {
    render(<ColumnDetailPanel table={table} />);
    expect(screen.getByText('users.id')).toBeInTheDocument();
  });

  it('shows index indicator badge', () => {
    render(<ColumnDetailPanel table={table} />);
    expect(screen.getByText('PK')).toBeInTheDocument();
  });
});
