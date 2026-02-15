import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSchemaExplorer } from './useSchemaExplorer';
import type { SchemaDataPort } from '../ports/schema-data-port';
import type { DiscoveredTable } from '../domain/schema-types';

const mockTables: DiscoveredTable[] = [
  {
    id: 't1', connectionId: 'conn-1', schemaName: 'public', tableName: 'users',
    columns: [{ columnName: 'id', dataType: 'int4', isNullable: false, ordinalPosition: 1 }],
    foreignKeys: [], indexes: [],
  },
  {
    id: 't2', connectionId: 'conn-1', schemaName: 'public', tableName: 'orders',
    columns: [{ columnName: 'id', dataType: 'int4', isNullable: false, ordinalPosition: 1 }],
    foreignKeys: [], indexes: [],
  },
  {
    id: 't3', connectionId: 'conn-1', schemaName: 'sales', tableName: 'invoices',
    columns: [], foreignKeys: [], indexes: [],
  },
];

function createMockPort(tables: DiscoveredTable[] = mockTables): SchemaDataPort {
  return { fetchTables: vi.fn().mockResolvedValue(tables) };
}

describe('useSchemaExplorer', () => {
  it('fetches tables on mount and exposes grouped data', async () => {
    const port = createMockPort();
    const { result } = renderHook(() => useSchemaExplorer(port, 'conn-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(port.fetchTables).toHaveBeenCalledWith('conn-1');
    expect(result.current.tables.length).toBe(3);
    expect(result.current.groupedTables.get('public')?.length).toBe(2);
    expect(result.current.groupedTables.get('sales')?.length).toBe(1);
  });

  it('filters tables when search term changes', async () => {
    const port = createMockPort();
    const { result } = renderHook(() => useSchemaExplorer(port, 'conn-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setSearchTerm('order'));

    expect(result.current.filteredTables.length).toBe(1);
    expect(result.current.filteredTables[0].tableName).toBe('orders');
  });

  it('exposes isLoading=true while fetching', () => {
    const port = { fetchTables: vi.fn().mockReturnValue(new Promise(() => {})) };
    const { result } = renderHook(() => useSchemaExplorer(port, 'conn-1'));

    expect(result.current.isLoading).toBe(true);
  });

  it('exposes error when fetch fails', async () => {
    const port = { fetchTables: vi.fn().mockRejectedValue(new Error('Network error')) };
    const { result } = renderHook(() => useSchemaExplorer(port, 'conn-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Network error');
  });
});
