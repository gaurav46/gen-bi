import { describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { SchemaController } from './schema.controller';
import { SchemaDiscoveryService, TENANT_DATABASE_PORT } from './schema-discovery.service';
import { TableRowsService } from './table-rows.service';
import { ConnectionsService } from '../connections/connections.service';
import type { TenantDatabasePort } from './tenant-database.port';

describe('GET /schema/:connectionId/tables/:schema/:table/rows (integration)', () => {
  it('returns paginated rows with PK info through real controller → service wiring', async () => {
    const mockTenantDb: TenantDatabasePort = {
      systemSchemaNames: new Set<string>(),
      connect: vi.fn(),
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('count(*)')) return { rows: [{ count: '3' }] };
        if (sql.includes('SELECT *')) return { rows: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }, { id: 3, name: 'Charlie' }] };
        if (sql.includes('PRIMARY KEY')) return { rows: [{ column_name: 'id' }] };
        return { rows: [] };
      }),
      queryIndexes: vi.fn().mockResolvedValue({ rows: [] }),
      disconnect: vi.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [SchemaController],
      providers: [
        TableRowsService,
        {
          provide: SchemaDiscoveryService,
          useValue: { getDiscoveryStatus: vi.fn(), analyzeSchemas: vi.fn(), getDiscoveredTables: vi.fn() },
        },
        {
          provide: ConnectionsService,
          useValue: {
            getTenantConnectionConfig: vi.fn().mockResolvedValue({
              host: 'localhost', port: 5432, database: 'testdb', username: 'user', password: 'pass',
              dbType: 'postgresql' as const,
            }),
          },
        },
        { provide: TENANT_DATABASE_PORT, useValue: mockTenantDb },
      ],
    }).compile();

    const controller = module.get<SchemaController>(SchemaController);

    const result = await controller.getTableRows('conn-123', 'public', 'users', '1');

    expect(result).toEqual({
      rows: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }, { id: 3, name: 'Charlie' }],
      totalRows: 3,
      page: 1,
      pageSize: 25,
      primaryKeyColumns: ['id'],
    });

    expect(mockTenantDb.connect).toHaveBeenCalled();
    expect(mockTenantDb.disconnect).toHaveBeenCalled();
  });
});
