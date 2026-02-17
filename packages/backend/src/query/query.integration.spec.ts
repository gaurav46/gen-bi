import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryService } from './query.service';
import type { LlmPort } from './llm.port';
import type { EmbeddingPort } from '../schema-discovery/embedding.port';
import type { SchemaRetrievalPort } from './schema-retrieval.port';
import type { TenantDatabasePort } from '../schema-discovery/tenant-database.port';
import type { ConnectionsService } from '../connections/connections.service';
import type { LlmQueryResponse } from './query.types';

describe('Query Integration: question -> embed -> retrieve -> generate -> validate -> execute -> results', () => {
  let service: QueryService;
  let connectionsService: Pick<ConnectionsService, 'getTenantConnectionConfig'>;
  let llmPort: LlmPort;
  let embeddingPort: EmbeddingPort;
  let schemaRetrievalPort: SchemaRetrievalPort;
  let tenantDatabasePort: TenantDatabasePort;

  const llmResponse: LlmQueryResponse = {
    intent: 'top_customers',
    title: 'Top Customers by Revenue',
    sql: 'SELECT name, SUM(total) FROM users GROUP BY name ORDER BY SUM(total) DESC LIMIT 10',
    visualization: { chartType: 'bar' },
    columns: [
      { name: 'name', type: 'varchar', role: 'dimension' },
      { name: 'total', type: 'numeric', role: 'measure' },
    ],
  };

  beforeEach(() => {
    connectionsService = {
      getTenantConnectionConfig: vi.fn().mockResolvedValue({
        host: 'localhost', port: 5432,
        database: 'tenant_db', username: 'user', password: 'pass',
      }),
    };

    embeddingPort = {
      generateEmbeddings: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
    };

    schemaRetrievalPort = {
      hasEmbeddings: vi.fn().mockResolvedValue(true),
      findRelevantColumns: vi.fn().mockResolvedValue([
        { tableName: 'users', columnName: 'name', dataType: 'varchar' },
        { tableName: 'users', columnName: 'total', dataType: 'numeric' },
      ]),
    };

    llmPort = {
      generateQuery: vi.fn().mockResolvedValue(llmResponse),
    };

    tenantDatabasePort = {
      connect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({
        rows: [
          { name: 'Alice', total: 500 },
          { name: 'Bob', total: 300 },
        ],
      }),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };

    service = new QueryService(
      connectionsService as ConnectionsService,
      llmPort,
      embeddingPort,
      schemaRetrievalPort,
      tenantDatabasePort,
    );
  });

  it('full journey: question -> embed -> retrieve -> generate -> validate -> execute -> results', async () => {
    const result = await service.query({
      connectionId: 'conn-1',
      question: 'Show top customers',
    });

    expect(embeddingPort.generateEmbeddings).toHaveBeenCalledWith(['Show top customers']);

    expect(schemaRetrievalPort.findRelevantColumns).toHaveBeenCalledWith(
      'conn-1',
      [0.1, 0.2, 0.3],
      expect.any(Number),
    );

    const prompt = vi.mocked(llmPort.generateQuery).mock.calls[0][0];
    expect(prompt).toContain('users');
    expect(prompt).toContain('name');
    expect(prompt).toContain('varchar');

    expect(tenantDatabasePort.query).toHaveBeenCalledWith(llmResponse.sql);

    expect(result).toEqual({
      intent: 'top_customers',
      title: 'Top Customers by Revenue',
      sql: llmResponse.sql,
      visualization: llmResponse.visualization,
      columns: llmResponse.columns,
      rows: [
        { name: 'Alice', total: 500 },
        { name: 'Bob', total: 300 },
      ],
      attempts: 1,
    });

    expect(tenantDatabasePort.disconnect).toHaveBeenCalled();
  });

  it('retries with error feedback when SQL execution fails, succeeds on second attempt', async () => {
    const failingSql = 'SELECT name FROM users WHERE name = 1';
    const goodSql = 'SELECT name, SUM(total) FROM users GROUP BY name ORDER BY SUM(total) DESC LIMIT 10';

    vi.mocked(llmPort.generateQuery)
      .mockResolvedValueOnce({ ...llmResponse, sql: failingSql })
      .mockResolvedValueOnce({ ...llmResponse, sql: goodSql });

    vi.mocked(tenantDatabasePort.query)
      .mockResolvedValueOnce({ rows: [{ name: 'Alice', total: 500 }] })
      .mockRejectedValueOnce(new Error('invalid input syntax for type varchar'))
      .mockResolvedValueOnce({ rows: [{ name: 'Alice', total: 500 }] });

    const result = await service.query({ connectionId: 'conn-1', question: 'Show top customers' });

    expect(llmPort.generateQuery).toHaveBeenCalledTimes(2);
    const secondPrompt = vi.mocked(llmPort.generateQuery).mock.calls[1][0];
    expect(secondPrompt).toContain('invalid input syntax for type varchar');
    expect(result.attempts).toBe(2);
    expect(result.rows).toEqual([{ name: 'Alice', total: 500 }]);
    expect(tenantDatabasePort.disconnect).toHaveBeenCalledTimes(1);
  });

  it('includes sample data rows in the prompt sent to LLM', async () => {
    vi.mocked(tenantDatabasePort.query)
      .mockResolvedValueOnce({ rows: [{ name: 'Alice', total: 500 }, { name: 'Bob', total: 300 }] })
      .mockResolvedValueOnce({ rows: [{ name: 'Alice', total: 500 }, { name: 'Bob', total: 300 }] });

    const result = await service.query({
      connectionId: 'conn-1',
      question: 'Show top customers',
    });

    const prompt = vi.mocked(llmPort.generateQuery).mock.calls[0][0];
    expect(prompt).toContain('Alice');
    expect(prompt).toContain('500');
    expect(prompt).toContain('users');
    expect(prompt).toContain('name');
    expect(prompt).toContain('varchar');

    expect(result.rows).toEqual([{ name: 'Alice', total: 500 }, { name: 'Bob', total: 300 }]);
  });

  it('returns error after 3 failed attempts with attempt count', async () => {
    vi.mocked(tenantDatabasePort.query).mockRejectedValue(
      new Error('some persistent DB error'),
    );

    await expect(service.query({ connectionId: 'conn-1', question: 'Show top customers' }))
      .rejects.toThrow(/after 3 attempts/);

    expect(llmPort.generateQuery).toHaveBeenCalledTimes(3);
    expect(tenantDatabasePort.disconnect).toHaveBeenCalled();
  });
});
