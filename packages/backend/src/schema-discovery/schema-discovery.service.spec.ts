import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { SchemaDiscoveryService } from './schema-discovery.service';
import type { TenantDatabasePort } from './tenant-database.port';
import type { EmbeddingPort } from './embedding.port';
import type { DescriptionSuggestionPort } from './description-suggestion.port';
import { ConnectionsService } from '../connections/connections.service';

const defaultTenantConfig = {
  host: 'localhost',
  port: 5432,
  database: 'tenant_db',
  username: 'tenant_user',
  password: 'tenant_password',
};

describe('SchemaDiscoveryService', () => {
  let service: SchemaDiscoveryService;
  let connectionsService: Pick<ConnectionsService, 'getTenantConnectionConfig'>;
  let tenantDatabasePort: TenantDatabasePort;
  let mockPrisma: Record<string, any>;
  let mockEmbeddingPort: EmbeddingPort;
  let mockDescriptionPort: DescriptionSuggestionPort;

  beforeEach(() => {
    connectionsService = {
      getTenantConnectionConfig: vi.fn(),
    } as unknown as Pick<ConnectionsService, 'getTenantConnectionConfig'>;

    tenantDatabasePort = {
      connect: vi.fn(),
      query: vi.fn(),
      disconnect: vi.fn(),
    };

    mockPrisma = {
      discoveredTable: {
        deleteMany: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([]),
      },
      $executeRaw: vi.fn().mockResolvedValue(undefined),
    };

    mockEmbeddingPort = {
      generateEmbeddings: vi.fn().mockImplementation(async (inputs: string[]) =>
        inputs.map(() => [0.0, 0.0]),
      ),
    };

    mockDescriptionPort = {
      suggestDescriptions: vi.fn().mockResolvedValue([]),
    };

    service = new SchemaDiscoveryService(
      connectionsService as ConnectionsService,
      tenantDatabasePort,
      mockPrisma,
      mockEmbeddingPort,
      mockDescriptionPort,
    );
  });

  it('loads config, connects, discovers schemas, filters system schemas, and disconnects', async () => {
    vi.mocked(connectionsService.getTenantConnectionConfig).mockResolvedValue(defaultTenantConfig);
    vi.mocked(tenantDatabasePort.query).mockResolvedValue({
      rows: [
        { schema_name: 'public' },
        { schema_name: 'sales' },
        { schema_name: 'information_schema' },
        { schema_name: 'pg_catalog' },
        { schema_name: 'pg_toast' },
      ],
    });

    const result = await service.testConnection('conn-id');

    expect(connectionsService.getTenantConnectionConfig).toHaveBeenCalledWith('conn-id');
    expect(tenantDatabasePort.connect).toHaveBeenCalledWith(defaultTenantConfig);
    expect(tenantDatabasePort.query).toHaveBeenCalledWith(
      'SELECT schema_name FROM information_schema.schemata ORDER BY schema_name ASC'
    );
    expect(tenantDatabasePort.disconnect).toHaveBeenCalled();
    expect(result).toEqual({ schemas: ['public', 'sales'] });
  });

  it('returns connection error when tenant DB is unreachable', async () => {
    vi.mocked(connectionsService.getTenantConnectionConfig).mockResolvedValue(defaultTenantConfig);
    vi.mocked(tenantDatabasePort.connect).mockRejectedValue(new Error('Failed to connect to tenant database: timeout'));

    await expect(service.testConnection('conn-id')).rejects.toThrow('Failed to connect to tenant database');
    expect(tenantDatabasePort.disconnect).toHaveBeenCalled();
  });

  it('throws error when database has zero non-system schemas', async () => {
    vi.mocked(connectionsService.getTenantConnectionConfig).mockResolvedValue(defaultTenantConfig);
    vi.mocked(tenantDatabasePort.query).mockResolvedValue({
      rows: [{ schema_name: 'information_schema' }, { schema_name: 'pg_catalog' }],
    });

    await expect(service.testConnection('conn-id')).rejects.toThrow('No non-system schemas found');
  });

  it('disconnect is called even when query fails', async () => {
    vi.mocked(connectionsService.getTenantConnectionConfig).mockResolvedValue(defaultTenantConfig);
    vi.mocked(tenantDatabasePort.query).mockRejectedValue(new Error('query failed'));

    await expect(service.testConnection('conn-id')).rejects.toThrow('query failed');
    expect(tenantDatabasePort.disconnect).toHaveBeenCalled();
  });

  it('filters all known PostgreSQL system schemas', async () => {
    vi.mocked(connectionsService.getTenantConnectionConfig).mockResolvedValue(defaultTenantConfig);
    vi.mocked(tenantDatabasePort.query).mockResolvedValue({
      rows: [
        { schema_name: 'public' },
        { schema_name: 'information_schema' },
        { schema_name: 'pg_catalog' },
        { schema_name: 'pg_toast' },
        { schema_name: 'pg_temp_1' },
        { schema_name: 'pg_toast_temp_1' },
      ],
    });

    await expect(service.testConnection('conn-id')).resolves.toEqual({ schemas: ['public'] });
  });

  it('returns 404 when connection config does not exist', async () => {
    vi.mocked(connectionsService.getTenantConnectionConfig).mockRejectedValue(new NotFoundException('Connection config conn-id not found'));

    await expect(service.testConnection('conn-id')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('analyzeSchemas discovers tables from information_schema for selected schemas', async () => {
    vi.mocked(connectionsService.getTenantConnectionConfig).mockResolvedValue(defaultTenantConfig);
    vi.mocked(tenantDatabasePort.query).mockImplementation(async (sql: string) => {
      if (sql.includes('information_schema.tables')) {
        return { rows: [
          { table_schema: 'public', table_name: 'users' },
          { table_schema: 'public', table_name: 'orders' },
        ]};
      }
      return { rows: [] };
    });

    const result = await service.analyzeSchemas('conn-id', ['public']);

    expect(connectionsService.getTenantConnectionConfig).toHaveBeenCalledWith('conn-id');
    expect(tenantDatabasePort.connect).toHaveBeenCalledWith(defaultTenantConfig);
    expect(tenantDatabasePort.query).toHaveBeenCalledWith(
      expect.stringContaining('information_schema.tables'),
      expect.arrayContaining(['public']),
    );
    expect(tenantDatabasePort.disconnect).toHaveBeenCalled();
    expect(result).toEqual({ tablesDiscovered: 2 });
  });

  it('analyzeSchemas discovers columns for each discovered table', async () => {
    vi.mocked(connectionsService.getTenantConnectionConfig).mockResolvedValue(defaultTenantConfig);
    vi.mocked(tenantDatabasePort.query).mockImplementation(async (sql: string) => {
      if (sql.includes('information_schema.tables')) {
        return { rows: [{ table_schema: 'public', table_name: 'users' }] };
      }
      if (sql.includes('information_schema.columns')) {
        return { rows: [
          { table_schema: 'public', table_name: 'users', column_name: 'id', data_type: 'uuid', is_nullable: 'NO', ordinal_position: 1 },
          { table_schema: 'public', table_name: 'users', column_name: 'name', data_type: 'varchar', is_nullable: 'YES', ordinal_position: 2 },
        ]};
      }
      return { rows: [] };
    });

    await service.analyzeSchemas('conn-id', ['public']);

    expect(tenantDatabasePort.query).toHaveBeenCalledWith(
      expect.stringContaining('information_schema.columns'),
      expect.arrayContaining(['public']),
    );
    expect(mockPrisma.discoveredTable.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          columns: { create: expect.arrayContaining([
            expect.objectContaining({ columnName: 'id', dataType: 'uuid', isNullable: false, ordinalPosition: 1 }),
            expect.objectContaining({ columnName: 'name', dataType: 'varchar', isNullable: true, ordinalPosition: 2 }),
          ])},
        }),
      }),
    );
  });

  it('analyzeSchemas discovers foreign keys via information_schema', async () => {
    vi.mocked(connectionsService.getTenantConnectionConfig).mockResolvedValue(defaultTenantConfig);
    vi.mocked(tenantDatabasePort.query).mockImplementation(async (sql: string) => {
      if (sql.includes('information_schema.tables')) {
        return { rows: [{ table_schema: 'public', table_name: 'orders' }] };
      }
      if (sql.includes('FOREIGN KEY')) {
        return { rows: [
          { table_schema: 'public', table_name: 'orders', column_name: 'user_id', foreign_table_schema: 'public', foreign_table_name: 'users', foreign_column_name: 'id', constraint_name: 'fk_orders_users' },
        ]};
      }
      return { rows: [] };
    });

    await service.analyzeSchemas('conn-id', ['public']);

    expect(tenantDatabasePort.query).toHaveBeenCalledWith(
      expect.stringContaining('FOREIGN KEY'),
      expect.arrayContaining(['public']),
    );
    expect(mockPrisma.discoveredTable.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          foreignKeys: { create: [expect.objectContaining({
            columnName: 'user_id',
            foreignTableSchema: 'public',
            foreignTableName: 'users',
            foreignColumnName: 'id',
            constraintName: 'fk_orders_users',
          })]},
        }),
      }),
    );
  });

  it('analyzeSchemas discovers indexes with correct column names', async () => {
    vi.mocked(connectionsService.getTenantConnectionConfig).mockResolvedValue(defaultTenantConfig);
    vi.mocked(tenantDatabasePort.query).mockImplementation(async (sql: string) => {
      if (sql.includes('information_schema.tables')) {
        return { rows: [{ table_schema: 'public', table_name: 'users' }] };
      }
      if (sql.includes('pg_index')) {
        return { rows: [
          { schemaname: 'public', tablename: 'users', indexname: 'users_pkey', columnname: 'id', is_unique: true },
        ]};
      }
      return { rows: [] };
    });

    await service.analyzeSchemas('conn-id', ['public']);

    expect(tenantDatabasePort.query).toHaveBeenCalledWith(
      expect.stringContaining('pg_index'),
      expect.arrayContaining(['public']),
    );
    expect(mockPrisma.discoveredTable.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          indexes: { create: [expect.objectContaining({
            indexName: 'users_pkey',
            columnName: 'id',
            isUnique: true,
          })]},
        }),
      }),
    );
  });

  it('analyzeSchemas deletes existing metadata and persists new results', async () => {
    vi.mocked(connectionsService.getTenantConnectionConfig).mockResolvedValue(defaultTenantConfig);
    vi.mocked(tenantDatabasePort.query).mockImplementation(async (sql: string) => {
      if (sql.includes('information_schema.tables')) {
        return { rows: [{ table_schema: 'public', table_name: 'users' }] };
      }
      return { rows: [] };
    });

    await service.analyzeSchemas('conn-id', ['public']);

    expect(mockPrisma.discoveredTable.deleteMany).toHaveBeenCalledWith({ where: { connectionId: 'conn-id' } });
    const deleteOrder = mockPrisma.discoveredTable.deleteMany.mock.invocationCallOrder[0];
    const createOrder = mockPrisma.discoveredTable.create.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(createOrder);
  });

  it('analyzeSchemas updates progress during analysis', async () => {
    vi.mocked(connectionsService.getTenantConnectionConfig).mockResolvedValue(defaultTenantConfig);
    vi.mocked(tenantDatabasePort.query).mockImplementation(async (sql: string) => {
      if (sql.includes('information_schema.tables')) {
        return { rows: [
          { table_schema: 'public', table_name: 'users' },
          { table_schema: 'public', table_name: 'orders' },
          { table_schema: 'public', table_name: 'products' },
        ]};
      }
      return { rows: [] };
    });

    await service.analyzeSchemas('conn-id', ['public']);

    const status = service.getDiscoveryStatus();
    expect(status).toEqual({ status: 'introspected', current: 3, total: 3, message: 'Introspection complete' });
  });

  it('getDiscoveredTables returns stored metadata with relations', async () => {
    const stored = [{ id: '1', connectionId: 'conn-id', schemaName: 'public', tableName: 'users', columns: [], foreignKeys: [], indexes: [] }];
    mockPrisma.discoveredTable.findMany.mockResolvedValue(stored);

    const result = await service.getDiscoveredTables('conn-id');

    expect(mockPrisma.discoveredTable.findMany).toHaveBeenCalledWith({
      where: { connectionId: 'conn-id' },
      include: { columns: true, foreignKeys: true, indexes: true },
    });
    expect(result).toEqual(stored);
  });

  it('analyzeSchemas throws error when selected schema has zero tables', async () => {
    vi.mocked(connectionsService.getTenantConnectionConfig).mockResolvedValue(defaultTenantConfig);
    vi.mocked(tenantDatabasePort.query).mockImplementation(async (sql: string) => {
      if (sql.includes('information_schema.tables')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    await expect(service.analyzeSchemas('conn-id', ['empty_schema'])).rejects.toThrow('No tables found in selected schemas');
  });

  it('analyzeSchemas handles 100+ tables without error', async () => {
    vi.mocked(connectionsService.getTenantConnectionConfig).mockResolvedValue(defaultTenantConfig);
    const tableRows = Array.from({ length: 120 }, (_, i) => ({ table_schema: 'public', table_name: `table_${i}` }));
    vi.mocked(tenantDatabasePort.query).mockImplementation(async (sql: string) => {
      if (sql.includes('information_schema.tables')) return { rows: tableRows };
      return { rows: [] };
    });

    const result = await service.analyzeSchemas('conn-id', ['public']);

    expect(result).toEqual({ tablesDiscovered: 120 });
    expect(mockPrisma.discoveredTable.create).toHaveBeenCalledTimes(120);
    expect(service.getDiscoveryStatus().total).toBe(120);
  });

  it('analyzeSchemas disconnects even when a query fails mid-analysis', async () => {
    vi.mocked(connectionsService.getTenantConnectionConfig).mockResolvedValue(defaultTenantConfig);
    vi.mocked(tenantDatabasePort.query).mockImplementation(async (sql: string) => {
      if (sql.includes('information_schema.tables')) {
        return { rows: [{ table_schema: 'public', table_name: 'users' }] };
      }
      if (sql.includes('information_schema.columns')) {
        throw new Error('column query failed');
      }
      return { rows: [] };
    });

    await expect(service.analyzeSchemas('conn-id', ['public'])).rejects.toThrow('column query failed');
    expect(tenantDatabasePort.disconnect).toHaveBeenCalled();
  });

  it('analyzeSchemas returns 404 when connectionId does not exist', async () => {
    vi.mocked(connectionsService.getTenantConnectionConfig).mockRejectedValue(new NotFoundException('not found'));

    await expect(service.analyzeSchemas('bad-id', ['public'])).rejects.toBeInstanceOf(NotFoundException);
  });

  it('schema names are parameterized in queries', async () => {
    vi.mocked(connectionsService.getTenantConnectionConfig).mockResolvedValue(defaultTenantConfig);
    vi.mocked(tenantDatabasePort.query).mockImplementation(async (sql: string) => {
      if (sql.includes('information_schema.tables')) {
        return { rows: [{ table_schema: 'public', table_name: 'users' }] };
      }
      return { rows: [] };
    });

    await service.analyzeSchemas('conn-id', ["'; DROP TABLE users; --"]);

    const tablesCall = vi.mocked(tenantDatabasePort.query).mock.calls.find(
      ([sql]) => sql.includes('information_schema.tables'),
    );
    expect(tablesCall![0]).not.toContain("DROP TABLE");
    expect(tablesCall![1]).toContain("'; DROP TABLE users; --");
  });

  it('getAnnotations returns ambiguous columns with AI-suggested descriptions', async () => {
    mockPrisma.discoveredTable.findMany.mockResolvedValue([
      {
        id: 'table-1',
        tableName: 'orders',
        schemaName: 'public',
        columns: [
          { id: 'col-1', columnName: 'amt_1', dataType: 'numeric', description: null },
          { id: 'col-2', columnName: 'email', dataType: 'varchar', description: null },
        ],
      },
    ]);

    vi.mocked(mockDescriptionPort.suggestDescriptions).mockResolvedValue([
      { columnName: 'amt_1', tableName: 'orders', description: 'Order subtotal amount' },
    ]);

    const result = await service.getAnnotations('conn-id');

    expect(result.columns).toHaveLength(1);
    expect(result.columns[0]).toEqual(
      expect.objectContaining({
        columnId: 'col-1',
        columnName: 'amt_1',
        tableName: 'orders',
        suggestedDescription: 'Order subtotal amount',
      }),
    );
  });

  it('getAnnotations returns ambiguous columns with null suggestions when AI fails', async () => {
    mockPrisma.discoveredTable.findMany.mockResolvedValue([
      {
        id: 'table-1',
        tableName: 'orders',
        schemaName: 'public',
        columns: [
          { id: 'col-1', columnName: 'amt_1', dataType: 'numeric', description: null },
        ],
      },
    ]);

    vi.mocked(mockDescriptionPort.suggestDescriptions).mockRejectedValue(new Error('API error'));

    const result = await service.getAnnotations('conn-id');

    expect(result.columns).toHaveLength(1);
    expect(result.columns[0].suggestedDescription).toBeNull();
  });

  it('analyzeSchemas does not call embedding port (embedding is a separate step)', async () => {
    vi.mocked(connectionsService.getTenantConnectionConfig).mockResolvedValue(defaultTenantConfig);
    vi.mocked(tenantDatabasePort.query).mockImplementation(async (sql: string) => {
      if (sql.includes('information_schema.tables')) {
        return { rows: [{ table_schema: 'public', table_name: 'users' }] };
      }
      if (sql.includes('information_schema.columns')) {
        return { rows: [
          { table_schema: 'public', table_name: 'users', column_name: 'id', data_type: 'uuid', is_nullable: 'NO', ordinal_position: 1 },
        ]};
      }
      return { rows: [] };
    });

    await service.analyzeSchemas('conn-id', ['public']);

    expect(mockEmbeddingPort.generateEmbeddings).not.toHaveBeenCalled();
  });

  it('analyzeSchemas sets status to introspected after persistence (no embedding)', async () => {
    vi.mocked(connectionsService.getTenantConnectionConfig).mockResolvedValue(defaultTenantConfig);
    vi.mocked(tenantDatabasePort.query).mockImplementation(async (sql: string) => {
      if (sql.includes('information_schema.tables')) {
        return { rows: [{ table_schema: 'public', table_name: 'users' }] };
      }
      if (sql.includes('information_schema.columns')) {
        return { rows: [
          { table_schema: 'public', table_name: 'users', column_name: 'id', data_type: 'uuid', is_nullable: 'NO', ordinal_position: 1 },
        ]};
      }
      return { rows: [] };
    });

    await service.analyzeSchemas('conn-id', ['public']);

    expect(service.getDiscoveryStatus().status).toBe('introspected');
    expect(mockEmbeddingPort.generateEmbeddings).not.toHaveBeenCalled();
  });

  it('second analyzeSchemas call while one is running rejects', async () => {
    vi.mocked(connectionsService.getTenantConnectionConfig).mockResolvedValue(defaultTenantConfig);
    let resolveQuery: () => void;
    const blockingPromise = new Promise<void>((r) => { resolveQuery = r; });
    vi.mocked(tenantDatabasePort.query).mockImplementation(async (sql: string) => {
      if (sql.includes('information_schema.tables')) {
        await blockingPromise;
        return { rows: [{ table_schema: 'public', table_name: 'users' }] };
      }
      return { rows: [] };
    });

    const first = service.analyzeSchemas('conn-id', ['public']);
    // Wait a tick so the first call reaches the blocking query
    await new Promise((r) => setTimeout(r, 10));

    await expect(service.analyzeSchemas('conn-id', ['public'])).rejects.toThrow('Analysis already in progress');

    resolveQuery!();
    await first;
  });

  it('saveAnnotations updates column descriptions in database', async () => {
    mockPrisma.discoveredColumn = {
      update: vi.fn().mockResolvedValue({}),
    };

    await service.saveAnnotations('conn-id', [
      { columnId: 'col-1', description: 'Order subtotal' },
    ]);

    expect(mockPrisma.discoveredColumn.update).toHaveBeenCalledWith({
      where: { id: 'col-1' },
      data: { description: 'Order subtotal' },
    });
  });

  it('embedColumns reads columns with descriptions and generates embeddings', async () => {
    mockPrisma.discoveredTable.findMany.mockResolvedValue([
      {
        id: 'table-1',
        connectionId: 'conn-id',
        schemaName: 'public',
        tableName: 'orders',
        columns: [
          { id: 'col-1', columnName: 'amt_1', dataType: 'numeric', description: 'Order subtotal amount' },
          { id: 'col-2', columnName: 'email', dataType: 'varchar', description: null },
        ],
      },
    ]);

    await service.embedColumns('conn-id');

    expect(mockEmbeddingPort.generateEmbeddings).toHaveBeenCalledWith([
      'orders.amt_1 numeric -- Order subtotal amount',
      'orders.email varchar',
    ]);

    expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    expect(service.getDiscoveryStatus().status).toBe('done');
  });

  it('embedColumns rejects when already embedding', async () => {
    let resolveFind: () => void;
    const blockingPromise = new Promise<void>((r) => { resolveFind = r; });
    mockPrisma.discoveredTable.findMany.mockImplementation(async () => {
      await blockingPromise;
      return [{ id: 'table-1', connectionId: 'conn-id', schemaName: 'public', tableName: 'orders', columns: [] }];
    });

    const first = service.embedColumns('conn-id');
    await new Promise((r) => setTimeout(r, 10));

    await expect(service.embedColumns('conn-id')).rejects.toThrow('Embedding already in progress');

    resolveFind!();
    await first;
  });
});
