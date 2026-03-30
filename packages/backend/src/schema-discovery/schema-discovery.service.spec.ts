import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { SchemaDiscoveryService } from './schema-discovery.service';
import type { TenantDatabasePort } from './tenant-database.port';
import type { EmbeddingPort } from './embedding.port';
import type { DescriptionSuggestionPort } from './description-suggestion.port';
import { ConnectionsService } from '../connections/connections.service';
import { DRIZZLE_CLIENT } from '../infrastructure/drizzle/client';

const defaultTenantConfig = {
  host: 'localhost',
  port: 5432,
  database: 'tenant_db',
  username: 'tenant_user',
  password: 'tenant_password',
  dbType: 'postgresql' as const,
};

function makeSelectChain(resolvedValue: unknown[]) {
  const where = vi.fn().mockResolvedValue(resolvedValue);
  const from = vi.fn().mockReturnValue({ where });
  return { from, where };
}

function makeInsertChain() {
  const execute = vi.fn().mockResolvedValue([]);
  const values = vi.fn().mockReturnValue({ execute, returning: vi.fn().mockResolvedValue([]) });
  const insert = vi.fn().mockReturnValue({ values });
  return { insert, values, execute };
}

function makeDeleteChain() {
  const where = vi.fn().mockResolvedValue(undefined);
  const deleteFrom = vi.fn().mockReturnValue({ where });
  return { deleteFrom, where };
}

function makeUpdateChain() {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  return { update, set, where };
}

describe('SchemaDiscoveryService', () => {
  let service: SchemaDiscoveryService;
  let connectionsService: Pick<ConnectionsService, 'getTenantConnectionConfig'>;
  let tenantDatabasePort: TenantDatabasePort;
  let mockDb: Record<string, any>;
  let mockEmbeddingPort: EmbeddingPort;
  let mockDescriptionPort: DescriptionSuggestionPort;

  beforeEach(() => {
    connectionsService = {
      getTenantConnectionConfig: vi.fn(),
    } as unknown as Pick<ConnectionsService, 'getTenantConnectionConfig'>;

    tenantDatabasePort = {
      systemSchemaNames: new Set(['information_schema', 'pg_catalog', 'pg_toast']),
      connect: vi.fn(),
      query: vi.fn(),
      queryIndexes: vi.fn().mockResolvedValue({ rows: [] }),
      disconnect: vi.fn(),
    };

    const insertChain = makeInsertChain();
    const deleteChain = makeDeleteChain();
    const updateChain = makeUpdateChain();

    mockDb = {
      select: vi.fn().mockReturnValue(makeSelectChain([])),
      insert: insertChain.insert,
      delete: deleteChain.deleteFrom,
      update: updateChain.update,
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
      mockDb as any,
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

    const allInsertValuesCalls = mockDb.insert.mock.calls.flatMap((_: unknown, callIndex: number) => {
      const valuesResult = mockDb.insert.mock.results[callIndex]?.value?.values;
      return valuesResult ? valuesResult.mock.calls : [];
    });

    const columnInsertCall = allInsertValuesCalls.find((args: unknown[]) => {
      const rows = Array.isArray(args[0]) ? args[0] : [];
      return rows.some((r: Record<string, unknown>) => r.columnName !== undefined);
    });

    expect(columnInsertCall).toBeDefined();
    const columnRows = columnInsertCall![0] as Record<string, unknown>[];
    expect(columnRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ columnName: 'id', dataType: 'uuid', isNullable: false, ordinalPosition: 1 }),
      expect.objectContaining({ columnName: 'name', dataType: 'varchar', isNullable: true, ordinalPosition: 2 }),
    ]));
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

    const allInsertValuesCalls = mockDb.insert.mock.calls.flatMap((_: unknown, callIndex: number) => {
      const valuesResult = mockDb.insert.mock.results[callIndex]?.value?.values;
      return valuesResult ? valuesResult.mock.calls : [];
    });

    const fkInsertCall = allInsertValuesCalls.find((args: unknown[]) => {
      const rows = Array.isArray(args[0]) ? args[0] : [];
      return rows.some((r: Record<string, unknown>) => r.constraintName !== undefined);
    });

    expect(fkInsertCall).toBeDefined();
    const fkRows = fkInsertCall![0] as Record<string, unknown>[];
    expect(fkRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        columnName: 'user_id',
        foreignTableSchema: 'public',
        foreignTableName: 'users',
        foreignColumnName: 'id',
        constraintName: 'fk_orders_users',
      }),
    ]));
  });

  it('analyzeSchemas discovers indexes with correct column names', async () => {
    vi.mocked(connectionsService.getTenantConnectionConfig).mockResolvedValue(defaultTenantConfig);
    vi.mocked(tenantDatabasePort.query).mockImplementation(async (sql: string) => {
      if (sql.includes('information_schema.tables')) {
        return { rows: [{ table_schema: 'public', table_name: 'users' }] };
      }
      return { rows: [] };
    });
    vi.mocked(tenantDatabasePort.queryIndexes).mockResolvedValue({
      rows: [
        { schemaname: 'public', tablename: 'users', indexname: 'users_pkey', columnname: 'id', is_unique: true },
      ],
    });

    await service.analyzeSchemas('conn-id', ['public']);

    expect(tenantDatabasePort.queryIndexes).toHaveBeenCalledWith(['public']);

    const allInsertValuesCalls = mockDb.insert.mock.calls.flatMap((_: unknown, callIndex: number) => {
      const valuesResult = mockDb.insert.mock.results[callIndex]?.value?.values;
      return valuesResult ? valuesResult.mock.calls : [];
    });

    const indexInsertCall = allInsertValuesCalls.find((args: unknown[]) => {
      const rows = Array.isArray(args[0]) ? args[0] : [];
      return rows.some((r: Record<string, unknown>) => r.indexName !== undefined);
    });

    expect(indexInsertCall).toBeDefined();
    const indexRows = indexInsertCall![0] as Record<string, unknown>[];
    expect(indexRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        indexName: 'users_pkey',
        columnName: 'id',
        isUnique: true,
      }),
    ]));
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

    expect(mockDb.delete).toHaveBeenCalled();
    const deleteWhere = mockDb.delete.mock.results[0].value.where;
    expect(deleteWhere).toHaveBeenCalled();

    expect(mockDb.insert).toHaveBeenCalled();
    const deleteOrder = mockDb.delete.mock.invocationCallOrder[0];
    const insertOrder = mockDb.insert.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(insertOrder);
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
    const tableRow = { id: '1', connectionId: 'conn-id', schemaName: 'public', tableName: 'users', createdAt: new Date() };
    const expectedResult = [{ ...tableRow, columns: [], foreignKeys: [], indexes: [] }];

    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeSelectChain([tableRow]);
      }
      return makeSelectChain([]);
    });

    const result = await service.getDiscoveredTables('conn-id');

    expect(mockDb.select).toHaveBeenCalled();
    expect(result).toEqual(expectedResult);
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
    let selectCallCount = 0;
    mockDb.select.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return makeSelectChain([
          { id: 'table-1', connectionId: 'conn-id', tableName: 'orders', schemaName: 'public', createdAt: new Date() },
        ]);
      }
      return makeSelectChain([
        { id: 'col-1', tableId: 'table-1', columnName: 'amt_1', dataType: 'numeric', description: null, isNullable: false, ordinalPosition: 1, createdAt: new Date(), updatedAt: new Date() },
        { id: 'col-2', tableId: 'table-1', columnName: 'email', dataType: 'varchar', description: null, isNullable: true, ordinalPosition: 2, createdAt: new Date(), updatedAt: new Date() },
      ]);
    });

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
    let selectCallCount = 0;
    mockDb.select.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return makeSelectChain([
          { id: 'table-1', connectionId: 'conn-id', tableName: 'orders', schemaName: 'public', createdAt: new Date() },
        ]);
      }
      return makeSelectChain([
        { id: 'col-1', tableId: 'table-1', columnName: 'amt_1', dataType: 'numeric', description: null, isNullable: false, ordinalPosition: 1, createdAt: new Date(), updatedAt: new Date() },
      ]);
    });

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
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    mockDb.update.mockReturnValue({ set: updateSet });

    await service.saveAnnotations('conn-id', [
      { columnId: 'col-1', description: 'Order subtotal' },
    ]);

    expect(mockDb.update).toHaveBeenCalled();
    expect(updateSet).toHaveBeenCalledWith({ description: 'Order subtotal' });
    expect(updateWhere).toHaveBeenCalled();
  });

  it('embedColumns reads columns with descriptions and generates embeddings', async () => {
    let selectCallCount = 0;
    mockDb.select.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return makeSelectChain([
          { id: 'table-1', connectionId: 'conn-id', schemaName: 'public', tableName: 'orders', createdAt: new Date() },
        ]);
      }
      return makeSelectChain([
        { id: 'col-1', tableId: 'table-1', columnName: 'amt_1', dataType: 'numeric', description: 'Order subtotal amount', isNullable: false, ordinalPosition: 1, createdAt: new Date(), updatedAt: new Date() },
        { id: 'col-2', tableId: 'table-1', columnName: 'email', dataType: 'varchar', description: null, isNullable: true, ordinalPosition: 2, createdAt: new Date(), updatedAt: new Date() },
      ]);
    });

    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    mockDb.delete.mockReturnValue({ where: deleteWhere });

    await service.embedColumns('conn-id');

    expect(mockEmbeddingPort.generateEmbeddings).toHaveBeenCalledWith([
      'orders.amt_1 numeric -- Order subtotal amount',
      'orders.email varchar',
    ]);

    expect(mockDb.delete).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();
    expect(service.getDiscoveryStatus().status).toBe('done');
  });

  it('embedColumns inserts rows with id values that are UUID strings (crypto.randomUUID format)', async () => {
    let selectCallCount = 0;
    mockDb.select.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return makeSelectChain([
          { id: 'table-1', connectionId: 'conn-id', schemaName: 'public', tableName: 'orders', createdAt: new Date() },
        ]);
      }
      return makeSelectChain([
        { id: 'col-1', tableId: 'table-1', columnName: 'total', dataType: 'numeric', description: null, isNullable: false, ordinalPosition: 1, createdAt: new Date(), updatedAt: new Date() },
      ]);
    });

    const capturedValues: unknown[] = [];
    const insertChain = makeInsertChain();
    insertChain.values.mockImplementation((rows: unknown) => {
      capturedValues.push(rows);
      return { execute: vi.fn().mockResolvedValue([]), returning: vi.fn().mockResolvedValue([]) };
    });
    mockDb.insert = insertChain.insert;
    mockDb.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    vi.mocked(mockEmbeddingPort.generateEmbeddings).mockResolvedValue([[0.1, 0.2, 0.3]]);

    await service.embedColumns('conn-id');

    expect(capturedValues.length).toBeGreaterThan(0);
    const insertedRows = capturedValues[0] as Array<Record<string, unknown>>;
    expect(Array.isArray(insertedRows)).toBe(true);
    const row = insertedRows[0];
    expect(typeof row.id).toBe('string');
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('embedColumns inserts embedding as plain number[] with no cast syntax', async () => {
    const embeddingVector = [0.1, 0.2, 0.3, 0.4];

    let selectCallCount = 0;
    mockDb.select.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return makeSelectChain([
          { id: 'table-1', connectionId: 'conn-id', schemaName: 'public', tableName: 'orders', createdAt: new Date() },
        ]);
      }
      return makeSelectChain([
        { id: 'col-1', tableId: 'table-1', columnName: 'total', dataType: 'numeric', description: null, isNullable: false, ordinalPosition: 1, createdAt: new Date(), updatedAt: new Date() },
      ]);
    });

    const capturedValues: unknown[] = [];
    const insertChain = makeInsertChain();
    insertChain.values.mockImplementation((rows: unknown) => {
      capturedValues.push(rows);
      return { execute: vi.fn().mockResolvedValue([]), returning: vi.fn().mockResolvedValue([]) };
    });
    mockDb.insert = insertChain.insert;
    mockDb.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    vi.mocked(mockEmbeddingPort.generateEmbeddings).mockResolvedValue([embeddingVector]);

    await service.embedColumns('conn-id');

    expect(capturedValues.length).toBeGreaterThan(0);
    const insertedRows = capturedValues[0] as Array<Record<string, unknown>>;
    const row = insertedRows[0];

    // Must be a plain array — not a string, not an object with cast syntax
    expect(Array.isArray(row.embedding)).toBe(true);
    expect(row.embedding).toEqual(embeddingVector);

    // Serialising should not produce any vector cast syntax
    const serialised = JSON.stringify(row.embedding);
    expect(serialised).not.toContain('::vector');
    expect(serialised).not.toContain('gen_random_uuid');
  });

  it('embedColumns rejects when already embedding', async () => {
    let resolveFind: () => void;
    const blockingPromise = new Promise<void>((r) => { resolveFind = r; });

    mockDb.select.mockImplementation(() => {
      const where = vi.fn().mockImplementation(async () => {
        await blockingPromise;
        return [{ id: 'table-1', connectionId: 'conn-id', schemaName: 'public', tableName: 'orders', createdAt: new Date() }];
      });
      return { from: vi.fn().mockReturnValue({ where }) };
    });

    const first = service.embedColumns('conn-id');
    await new Promise((r) => setTimeout(r, 10));

    await expect(service.embedColumns('conn-id')).rejects.toThrow('Embedding already in progress');

    resolveFind!();
    await first;
  });

  // Slice 4 — systemSchemaNames delegation
  describe('systemSchemaNames delegation', () => {
    it('filters only the schemas present in the port systemSchemaNames set when the set is custom', async () => {
      const customPort: TenantDatabasePort = {
        systemSchemaNames: new Set(['sys', 'INFORMATION_SCHEMA']),
        connect: vi.fn(),
        query: vi.fn().mockResolvedValue({
          rows: [
            { schema_name: 'dbo' },
            { schema_name: 'sys' },
            { schema_name: 'INFORMATION_SCHEMA' },
          ],
        }),
        disconnect: vi.fn(),
      };

      vi.mocked(connectionsService.getTenantConnectionConfig).mockResolvedValue(defaultTenantConfig);

      const customService = new SchemaDiscoveryService(
        connectionsService as ConnectionsService,
        customPort,
        mockDb as any,
        mockEmbeddingPort,
        mockDescriptionPort,
      );

      const result = await customService.testConnection('conn-id');

      expect(result.schemas).toEqual(['dbo']);
    });

    it('does not filter schemas that are absent from the port systemSchemaNames set', async () => {
      const emptySetPort: TenantDatabasePort = {
        systemSchemaNames: new Set(),
        connect: vi.fn(),
        query: vi.fn().mockResolvedValue({
          rows: [
            { schema_name: 'public' },
            { schema_name: 'analytics' },
          ],
        }),
        disconnect: vi.fn(),
      };

      vi.mocked(connectionsService.getTenantConnectionConfig).mockResolvedValue(defaultTenantConfig);

      const emptySetService = new SchemaDiscoveryService(
        connectionsService as ConnectionsService,
        emptySetPort,
        mockDb as any,
        mockEmbeddingPort,
        mockDescriptionPort,
      );

      const result = await emptySetService.testConnection('conn-id');

      expect(result.schemas).toEqual(['public', 'analytics']);
    });

    it('retains existing PostgreSQL filtering behaviour when the adapter carries the PostgreSQL set', async () => {
      vi.mocked(connectionsService.getTenantConnectionConfig).mockResolvedValue(defaultTenantConfig);
      vi.mocked(tenantDatabasePort.query).mockResolvedValue({
        rows: [
          { schema_name: 'app' },
          { schema_name: 'information_schema' },
          { schema_name: 'pg_catalog' },
          { schema_name: 'pg_toast' },
        ],
      });

      const result = await service.testConnection('conn-id');

      expect(result.schemas).toEqual(['app']);
    });
  });
});
