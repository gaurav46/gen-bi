import { describe, it, expect, vi } from 'vitest';
import { SchemaDiscoveryService } from './schema-discovery.service';
import type { TenantDatabasePort } from './tenant-database.port';
import type { EmbeddingPort } from './embedding.port';
import { ConnectionsService } from '../connections/connections.service';

describe('Embedding Integration', () => {
  it('analyzeSchemas discovers metadata and sets status to introspected (no embedding)', async () => {
    const connectionsService = {
      getTenantConnectionConfig: vi.fn().mockResolvedValue({
        host: 'localhost',
        port: 5432,
        database: 'tenant_db',
        username: 'user',
        password: 'pass',
      }),
    } as unknown as ConnectionsService;

    const tenantDatabasePort: TenantDatabasePort = {
      connect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('information_schema.tables')) {
          return { rows: [{ table_schema: 'public', table_name: 'users' }] };
        }
        if (sql.includes('information_schema.columns')) {
          return {
            rows: [
              { table_schema: 'public', table_name: 'users', column_name: 'id', data_type: 'uuid', is_nullable: 'NO', ordinal_position: 1 },
              { table_schema: 'public', table_name: 'users', column_name: 'email', data_type: 'varchar', is_nullable: 'YES', ordinal_position: 2 },
            ],
          };
        }
        return { rows: [] };
      }),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };

    const embeddingPort: EmbeddingPort = {
      generateEmbeddings: vi.fn(),
    };

    const mockPrisma = {
      discoveredTable: {
        deleteMany: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([]),
      },
      $executeRaw: vi.fn().mockResolvedValue(undefined),
    };

    const service = new SchemaDiscoveryService(
      connectionsService,
      tenantDatabasePort,
      mockPrisma,
      embeddingPort,
    );

    await service.analyzeSchemas('conn-id', ['public']);

    expect(mockPrisma.discoveredTable.create).toHaveBeenCalled();
    expect(embeddingPort.generateEmbeddings).not.toHaveBeenCalled();

    const finalStatus = service.getDiscoveryStatus();
    expect(finalStatus.status).toBe('introspected');
  });
});
