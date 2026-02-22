import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FetchSchemaDataAdapter } from './fetch-schema-data-adapter';

describe('FetchSchemaDataAdapter', () => {
  const adapter = new FetchSchemaDataAdapter();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches table rows from /api/schema/:connectionId/tables/:schema/:table/rows', async () => {
    const mockResponse = {
      rows: [{ id: 1, name: 'Alice' }],
      totalRows: 1,
      page: 1,
      pageSize: 25,
      primaryKeyColumns: ['id'],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    }));

    const result = await adapter.fetchTableRows('c1', 'public', 'users', 1);

    expect(fetch).toHaveBeenCalledWith('/api/schema/c1/tables/public/users/rows?page=1');
    expect(result).toEqual(mockResponse);
  });

  it('fetches tables from /api/schema/:connectionId/tables', async () => {
    const mockTables = [{ id: 't1', connectionId: 'c1', schemaName: 'public', tableName: 'users', columns: [], foreignKeys: [], indexes: [] }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTables),
    }));

    const result = await adapter.fetchTables('c1');

    expect(fetch).toHaveBeenCalledWith('/api/schema/c1/tables');
    expect(result).toEqual(mockTables);
  });

  it('throws error when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    }));

    await expect(adapter.fetchTables('c1')).rejects.toThrow('Failed to fetch tables: 500 Internal Server Error');
  });
});
