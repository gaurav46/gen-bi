import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SchemaDiscoveryService } from './schema-discovery.service';
import type { TenantDatabasePort } from './tenant-database.port';
import type { EmbeddingPort } from './embedding.port';
import { ConnectionsService } from '../connections/connections.service';

describe('Embedding Integration', () => {
  it('analyzeSchemas discovers metadata then generates and stores embeddings', async () => {
    const connectionsService = {
      findOne: vi.fn().mockResolvedValue({
        id: 'conn-id',
        host: 'localhost',
        port: 5432,
        databaseName: 'tenant_db',
        username: 'user',
        password: 'pass',
        createdAt: new Date(),
        updatedAt: new Date(),
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
      generateEmbeddings: vi.fn().mockResolvedValue([
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ]),
    };

    const mockPrisma = {
      discoveredTable: {
        deleteMany: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([]),
      },
      $executeRaw: vi.fn().mockResolvedValue(undefined),
    };

    const progressMessages: string[] = [];
    const service = new SchemaDiscoveryService(
      connectionsService,
      tenantDatabasePort,
      mockPrisma,
      embeddingPort,
    );

    const originalGetStatus = service.getDiscoveryStatus.bind(service);
    vi.spyOn(embeddingPort, 'generateEmbeddings').mockImplementation(async (inputs) => {
      progressMessages.push(service.getDiscoveryStatus().message);
      return inputs.map(() => [0.1, 0.2, 0.3]);
    });

    await service.analyzeSchemas('conn-id', ['public']);

    expect(embeddingPort.generateEmbeddings).toHaveBeenCalledWith([
      'users.id uuid',
      'users.email varchar',
    ]);

    const executeRawCalls = mockPrisma.$executeRaw.mock.calls;
    const hasDelete = executeRawCalls.some((call: any[]) => {
      const sql = String(call[0]?.strings?.[0] ?? call[0] ?? '');
      return sql.includes('DELETE');
    });
    expect(hasDelete).toBe(true);

    const hasInsert = executeRawCalls.some((call: any[]) => {
      const sql = String(call[0]?.strings?.[0] ?? call[0] ?? '');
      return sql.includes('INSERT');
    });
    expect(hasInsert).toBe(true);

    const finalStatus = service.getDiscoveryStatus();
    expect(finalStatus).toEqual({ status: 'done', current: 1, total: 1, message: 'Analysis complete' });

    expect(progressMessages.some((m) => m.includes('Generating embeddings'))).toBe(true);
  });
});
