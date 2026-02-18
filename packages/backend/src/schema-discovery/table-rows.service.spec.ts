import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TableRowsService } from './table-rows.service';
import type { TenantDatabasePort } from './tenant-database.port';
import { ConnectionsService } from '../connections/connections.service';

const defaultConfig = {
  host: 'localhost',
  port: 5432,
  database: 'tenant_db',
  username: 'user',
  password: 'pass',
};

describe('TableRowsService', () => {
  let service: TableRowsService;
  let connectionsService: Pick<ConnectionsService, 'getTenantConnectionConfig'>;
  let tenantDb: TenantDatabasePort;

  beforeEach(() => {
    connectionsService = {
      getTenantConnectionConfig: vi.fn().mockResolvedValue(defaultConfig),
    } as unknown as Pick<ConnectionsService, 'getTenantConnectionConfig'>;

    tenantDb = {
      connect: vi.fn(),
      query: vi.fn(),
      disconnect: vi.fn(),
    };

    service = new TableRowsService(
      connectionsService as ConnectionsService,
      tenantDb,
    );
  });

  it('fetchRows returns paginated rows, total count, and PK columns', async () => {
    vi.mocked(tenantDb.query).mockImplementation(async (sql: string) => {
      if (sql.includes('count(*)')) return { rows: [{ count: '42' }] };
      if (sql.includes('SELECT *')) return { rows: [{ id: 1, name: 'Alice' }] };
      if (sql.includes('PRIMARY KEY')) return { rows: [{ column_name: 'id' }] };
      return { rows: [] };
    });

    const result = await service.fetchRows('conn-id', 'public', 'users', 1);

    expect(result).toEqual({
      rows: [{ id: 1, name: 'Alice' }],
      totalRows: 42,
      page: 1,
      pageSize: 25,
      primaryKeyColumns: ['id'],
    });
    expect(tenantDb.connect).toHaveBeenCalledWith(defaultConfig);
    expect(tenantDb.disconnect).toHaveBeenCalled();
  });

  it('fetchRows throws BadRequestException when page is less than 1', async () => {
    await expect(service.fetchRows('conn-id', 'public', 'users', 0)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.fetchRows('conn-id', 'public', 'users', -1)).rejects.toBeInstanceOf(BadRequestException);
    expect(tenantDb.connect).not.toHaveBeenCalled();
  });

  it('fetchRows propagates NotFoundException when connection does not exist', async () => {
    vi.mocked(connectionsService.getTenantConnectionConfig).mockRejectedValue(
      new NotFoundException('Connection config conn-id not found'),
    );

    await expect(service.fetchRows('bad-id', 'public', 'users', 1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('fetchRows throws NotFoundException when table does not exist in tenant DB', async () => {
    const pgError = new Error('relation "public.nonexistent" does not exist');
    (pgError as any).code = '42P01';
    vi.mocked(tenantDb.query).mockRejectedValue(pgError);

    await expect(service.fetchRows('conn-id', 'public', 'nonexistent', 1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('fetchRows returns empty rows array when table has zero rows', async () => {
    vi.mocked(tenantDb.query).mockImplementation(async (sql: string) => {
      if (sql.includes('count(*)')) return { rows: [{ count: '0' }] };
      if (sql.includes('SELECT *')) return { rows: [] };
      if (sql.includes('PRIMARY KEY')) return { rows: [{ column_name: 'id' }] };
      return { rows: [] };
    });

    const result = await service.fetchRows('conn-id', 'public', 'empty_table', 1);

    expect(result.rows).toEqual([]);
    expect(result.totalRows).toBe(0);
  });

  it('fetchRows returns empty primaryKeyColumns when table has no PK', async () => {
    vi.mocked(tenantDb.query).mockImplementation(async (sql: string) => {
      if (sql.includes('count(*)')) return { rows: [{ count: '5' }] };
      if (sql.includes('SELECT *')) return { rows: [{ col: 'val' }] };
      if (sql.includes('PRIMARY KEY')) return { rows: [] };
      return { rows: [] };
    });

    const result = await service.fetchRows('conn-id', 'public', 'no_pk', 1);

    expect(result.primaryKeyColumns).toEqual([]);
  });

  it('fetchRows disconnects even when a query fails', async () => {
    vi.mocked(tenantDb.query).mockRejectedValue(new Error('query boom'));

    await expect(service.fetchRows('conn-id', 'public', 'users', 1)).rejects.toThrow();
    expect(tenantDb.disconnect).toHaveBeenCalled();
  });
});
