import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { SchemaDiscoveryService } from './schema-discovery.service';
import type { TenantDatabasePort } from './tenant-database.port';
import { ConnectionsService } from '../connections/connections.service';

describe('SchemaDiscoveryService', () => {
  let service: SchemaDiscoveryService;
  let connectionsService: Pick<ConnectionsService, 'findOne'>;
  let tenantDatabasePort: TenantDatabasePort;

  beforeEach(() => {
    connectionsService = {
      findOne: vi.fn(),
    } as unknown as Pick<ConnectionsService, 'findOne'>;

    tenantDatabasePort = {
      connect: vi.fn(),
      query: vi.fn(),
      disconnect: vi.fn(),
    };

    service = new SchemaDiscoveryService(connectionsService as ConnectionsService, tenantDatabasePort);
  });

  it('loads config, connects, discovers schemas, filters system schemas, and disconnects', async () => {
    vi.mocked(connectionsService.findOne).mockResolvedValue({
      id: 'conn-id',
      host: 'localhost',
      port: 5432,
      databaseName: 'tenant_db',
      username: 'tenant_user',
      password: 'tenant_password',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
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

    expect(connectionsService.findOne).toHaveBeenCalledWith('conn-id');
    expect(tenantDatabasePort.connect).toHaveBeenCalledWith({
      host: 'localhost',
      port: 5432,
      database: 'tenant_db',
      username: 'tenant_user',
      password: 'tenant_password',
    });
    expect(tenantDatabasePort.query).toHaveBeenCalledWith(
      'SELECT schema_name FROM information_schema.schemata ORDER BY schema_name ASC'
    );
    expect(tenantDatabasePort.disconnect).toHaveBeenCalled();
    expect(result).toEqual({ schemas: ['public', 'sales'] });
  });

  it('returns connection error when tenant DB is unreachable', async () => {
    vi.mocked(connectionsService.findOne).mockResolvedValue({
      id: 'conn-id',
      host: 'localhost',
      port: 5432,
      databaseName: 'tenant_db',
      username: 'tenant_user',
      password: 'tenant_password',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(tenantDatabasePort.connect).mockRejectedValue(new Error('Failed to connect to tenant database: timeout'));

    await expect(service.testConnection('conn-id')).rejects.toThrow('Failed to connect to tenant database');
    expect(tenantDatabasePort.disconnect).toHaveBeenCalled();
  });

  it('throws error when database has zero non-system schemas', async () => {
    vi.mocked(connectionsService.findOne).mockResolvedValue({
      id: 'conn-id',
      host: 'localhost',
      port: 5432,
      databaseName: 'tenant_db',
      username: 'tenant_user',
      password: 'tenant_password',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(tenantDatabasePort.query).mockResolvedValue({
      rows: [{ schema_name: 'information_schema' }, { schema_name: 'pg_catalog' }],
    });

    await expect(service.testConnection('conn-id')).rejects.toThrow('No non-system schemas found');
  });

  it('disconnect is called even when query fails', async () => {
    vi.mocked(connectionsService.findOne).mockResolvedValue({
      id: 'conn-id',
      host: 'localhost',
      port: 5432,
      databaseName: 'tenant_db',
      username: 'tenant_user',
      password: 'tenant_password',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(tenantDatabasePort.query).mockRejectedValue(new Error('query failed'));

    await expect(service.testConnection('conn-id')).rejects.toThrow('query failed');
    expect(tenantDatabasePort.disconnect).toHaveBeenCalled();
  });

  it('filters all known PostgreSQL system schemas', async () => {
    vi.mocked(connectionsService.findOne).mockResolvedValue({
      id: 'conn-id',
      host: 'localhost',
      port: 5432,
      databaseName: 'tenant_db',
      username: 'tenant_user',
      password: 'tenant_password',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
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
    vi.mocked(connectionsService.findOne).mockRejectedValue(new NotFoundException('Connection config conn-id not found'));

    await expect(service.testConnection('conn-id')).rejects.toBeInstanceOf(NotFoundException);
  });
});
