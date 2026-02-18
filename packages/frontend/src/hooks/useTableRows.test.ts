import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useTableRows } from './useTableRows';
import type { SchemaDataPort } from '../ports/schema-data-port';
import type { TableRowsResponse } from '../domain/schema-types';

const sampleResponse: TableRowsResponse = {
  rows: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
  totalRows: 50,
  page: 1,
  pageSize: 25,
  primaryKeyColumns: ['id'],
};

function createMockPort(response: TableRowsResponse = sampleResponse): SchemaDataPort {
  return {
    fetchTables: vi.fn(),
    fetchTableRows: vi.fn().mockResolvedValue(response),
  };
}

const tableRef = { connectionId: 'conn-1', schemaName: 'public', tableName: 'users' };

describe('useTableRows', () => {
  it('fetches rows on mount and exposes row data', async () => {
    const port = createMockPort();
    const { result } = renderHook(() => useTableRows(port, tableRef));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(port.fetchTableRows).toHaveBeenCalledWith('conn-1', 'public', 'users', 1);
    expect(result.current.rows).toEqual(sampleResponse.rows);
    expect(result.current.totalRows).toBe(50);
    expect(result.current.page).toBe(1);
  });

  it('exposes isLoading true while fetching', () => {
    const port: SchemaDataPort = {
      fetchTables: vi.fn(),
      fetchTableRows: vi.fn().mockReturnValue(new Promise(() => {})),
    };
    const { result } = renderHook(() => useTableRows(port, tableRef));

    expect(result.current.isLoading).toBe(true);
  });

  it('exposes error when fetch fails', async () => {
    const port: SchemaDataPort = {
      fetchTables: vi.fn(),
      fetchTableRows: vi.fn().mockRejectedValue(new Error('Connection timeout')),
    };
    const { result } = renderHook(() => useTableRows(port, tableRef));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Connection timeout');
  });

  it('goToNextPage fetches the next page', async () => {
    const port = createMockPort();
    const { result } = renderHook(() => useTableRows(port, tableRef));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.goToNextPage());

    await waitFor(() => expect(port.fetchTableRows).toHaveBeenCalledWith('conn-1', 'public', 'users', 2));
  });

  it('goToPreviousPage fetches the previous page', async () => {
    const port = createMockPort();
    const page2Response = { ...sampleResponse, page: 2 };
    (port.fetchTableRows as ReturnType<typeof vi.fn>).mockResolvedValue(page2Response);
    const { result } = renderHook(() => useTableRows(port, tableRef));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.goToNextPage());
    await waitFor(() => expect(result.current.page).toBe(2));

    act(() => result.current.goToPreviousPage());
    await waitFor(() => expect(port.fetchTableRows).toHaveBeenCalledWith('conn-1', 'public', 'users', 1));
  });

  it('resets to page 1 when table changes', async () => {
    const port = createMockPort();
    const { result, rerender } = renderHook(
      ({ table }) => useTableRows(port, table),
      { initialProps: { table: tableRef } },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.goToNextPage());
    await waitFor(() => expect(result.current.page).toBe(2));

    rerender({ table: { connectionId: 'conn-1', schemaName: 'public', tableName: 'orders' } });

    await waitFor(() => expect(result.current.page).toBe(1));
    expect(port.fetchTableRows).toHaveBeenCalledWith('conn-1', 'public', 'orders', 1);
  });

  it('retry re-fetches after error', async () => {
    const port: SchemaDataPort = {
      fetchTables: vi.fn(),
      fetchTableRows: vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(sampleResponse),
    };
    const { result } = renderHook(() => useTableRows(port, tableRef));

    await waitFor(() => expect(result.current.error).toBe('Network error'));

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.rows).toEqual(sampleResponse.rows));
    expect(result.current.error).toBeNull();
  });

  it('does not fetch when table is null', () => {
    const port = createMockPort();
    const { result } = renderHook(() => useTableRows(port, null));

    expect(port.fetchTableRows).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.rows).toEqual([]);
  });
});
