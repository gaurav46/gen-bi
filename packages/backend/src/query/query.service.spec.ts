import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QueryService } from './query.service';
import type { LlmPort } from './llm.port';
import type { ConnectionsService } from '../connections/connections.service';
import type { LlmQueryResponse } from './query.types';
import type { EmbeddingPort } from '../schema-discovery/embedding.port';
import type { SchemaRetrievalPort } from './schema-retrieval.port';
import type { TenantDatabasePort } from '../schema-discovery/tenant-database.port';

const cannedLlmResponse: LlmQueryResponse = {
  intent: 'top_customers',
  title: 'Top Customers by Revenue',
  sql: 'SELECT name, SUM(total) FROM users GROUP BY name ORDER BY SUM(total) DESC LIMIT 10',
  visualization: { chartType: 'bar' },
  columns: [
    { name: 'name', type: 'varchar', role: 'dimension' },
    { name: 'total', type: 'numeric', role: 'measure' },
  ],
};

const tenantConfig = {
  host: 'localhost',
  port: 5432,
  database: 'tenant_db',
  username: 'user',
  password: 'pass',
};

const relevantColumns = [
  { tableName: 'users', columnName: 'name', dataType: 'varchar' },
  { tableName: 'users', columnName: 'total', dataType: 'numeric' },
];

describe('QueryService', () => {
  let service: QueryService;
  let connectionsService: Pick<ConnectionsService, 'getTenantConnectionConfig'>;
  let llmPort: LlmPort;
  let embeddingPort: EmbeddingPort;
  let schemaRetrievalPort: SchemaRetrievalPort;
  let tenantDatabasePort: TenantDatabasePort;

  beforeEach(() => {
    connectionsService = {
      getTenantConnectionConfig: vi.fn().mockResolvedValue(tenantConfig),
    };

    llmPort = {
      generateQuery: vi.fn().mockResolvedValue(cannedLlmResponse),
    };

    embeddingPort = {
      generateEmbeddings: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
    };

    schemaRetrievalPort = {
      hasEmbeddings: vi.fn().mockResolvedValue(true),
      findRelevantColumns: vi.fn().mockResolvedValue(relevantColumns),
    };

    tenantDatabasePort = {
      connect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({ rows: [{ name: 'Alice', total: 100 }] }),
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

  it('validates connection, builds prompt, calls LLM port, returns response', async () => {
    const result = await service.query({ connectionId: 'conn-1', question: 'Show top customers' });

    expect(connectionsService.getTenantConnectionConfig).toHaveBeenCalledWith('conn-1');
    expect(llmPort.generateQuery).toHaveBeenCalledWith(expect.any(String));
    expect(result.intent).toBe('top_customers');
  });

  it('throws when connectionId not found', async () => {
    vi.mocked(connectionsService.getTenantConnectionConfig).mockRejectedValue(
      new NotFoundException('Connection config conn-1 not found'),
    );

    await expect(service.query({ connectionId: 'conn-1', question: 'test' }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws when LLM port errors', async () => {
    vi.mocked(llmPort.generateQuery).mockRejectedValue(
      new Error('ANTHROPIC_API_KEY is not configured'),
    );

    await expect(service.query({ connectionId: 'conn-1', question: 'test' }))
      .rejects.toThrow('ANTHROPIC_API_KEY is not configured');
  });

  it('includes question in the prompt sent to LLM', async () => {
    await service.query({ connectionId: 'conn-1', question: 'Show top customers' });

    const prompt = vi.mocked(llmPort.generateQuery).mock.calls[0][0];
    expect(prompt).toContain('Show top customers');
  });

  it('embeds question and retrieves relevant columns for schema context', async () => {
    await service.query({ connectionId: 'conn-1', question: 'Show top customers' });

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
  });

  it('throws BadRequestException when no embeddings exist for connection', async () => {
    vi.mocked(schemaRetrievalPort.hasEmbeddings).mockResolvedValue(false);

    await expect(service.query({ connectionId: 'conn-1', question: 'test' }))
      .rejects.toThrow(BadRequestException);
    await expect(service.query({ connectionId: 'conn-1', question: 'test' }))
      .rejects.toThrow('No embeddings found');
  });

  it('validates generated SQL is SELECT-only before execution', async () => {
    vi.mocked(llmPort.generateQuery).mockResolvedValue({
      ...cannedLlmResponse,
      sql: 'DELETE FROM users WHERE id = 1',
    });

    await expect(service.query({ connectionId: 'conn-1', question: 'test' }))
      .rejects.toThrow(BadRequestException);
    const queryCalls = vi.mocked(tenantDatabasePort.query).mock.calls;
    const nonSampleCalls = queryCalls.filter(([sql]) => !sql.includes('LIMIT 5'));
    expect(nonSampleCalls).toHaveLength(0);
  });

  it('executes validated SQL against tenant DB and returns rows with metadata', async () => {
    const result = await service.query({ connectionId: 'conn-1', question: 'Show top customers' });

    expect(tenantDatabasePort.connect).toHaveBeenCalledWith(tenantConfig);
    expect(tenantDatabasePort.query).toHaveBeenCalledWith(cannedLlmResponse.sql);
    expect(tenantDatabasePort.disconnect).toHaveBeenCalled();
    expect(result.rows).toEqual([{ name: 'Alice', total: 100 }]);
    expect(result.intent).toBe('top_customers');
    expect(result.attempts).toBe(1);
  });

  it('enforces query timeout on tenant DB execution and retries', async () => {
    vi.mocked(tenantDatabasePort.query)
      .mockResolvedValueOnce({ rows: [] })
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce({ rows: [{ name: 'Alice', total: 100 }] });

    const result = await service.query({ connectionId: 'conn-1', question: 'test' });

    expect(result.attempts).toBe(2);
    expect(tenantDatabasePort.disconnect).toHaveBeenCalled();
  }, 15000);

  it('returns error when SQL execution fails after all retries', async () => {
    vi.mocked(tenantDatabasePort.query).mockRejectedValue(
      new Error('relation "users" does not exist'),
    );

    await expect(service.query({ connectionId: 'conn-1', question: 'test' }))
      .rejects.toThrow(/after 3 attempts/);
    expect(tenantDatabasePort.disconnect).toHaveBeenCalled();
  });

  it('disconnects tenant DB even when validation fails after connect', async () => {
    vi.mocked(llmPort.generateQuery).mockResolvedValue({
      ...cannedLlmResponse,
      sql: 'DELETE FROM users',
    });

    await expect(service.query({ connectionId: 'conn-1', question: 'test' }))
      .rejects.toThrow();
  });

  it('retries with error feedback when execution fails, returns result on success', async () => {
    const failingSql = 'SELECT name FROM users WHERE name = 1';
    vi.mocked(llmPort.generateQuery)
      .mockResolvedValueOnce({ ...cannedLlmResponse, sql: failingSql })
      .mockResolvedValueOnce(cannedLlmResponse);

    vi.mocked(tenantDatabasePort.query)
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error('invalid input syntax for type varchar'))
      .mockResolvedValueOnce({ rows: [{ name: 'Alice', total: 100 }] });

    const result = await service.query({ connectionId: 'conn-1', question: 'Show top customers' });

    expect(llmPort.generateQuery).toHaveBeenCalledTimes(2);
    const secondPrompt = vi.mocked(llmPort.generateQuery).mock.calls[1][0];
    expect(secondPrompt).toContain('invalid input syntax for type varchar');
    expect(result.attempts).toBe(2);
    expect(result.rows).toEqual([{ name: 'Alice', total: 100 }]);
  });

  it('throws after 3 failed execution attempts with clear error', async () => {
    vi.mocked(tenantDatabasePort.query).mockRejectedValue(
      new Error('persistent error'),
    );

    await expect(service.query({ connectionId: 'conn-1', question: 'test' }))
      .rejects.toThrow(/after 3 attempts/);
    expect(llmPort.generateQuery).toHaveBeenCalledTimes(3);
    expect(tenantDatabasePort.disconnect).toHaveBeenCalled();
  });

  it('re-validates corrected SQL on each retry attempt', async () => {
    const failingSql = 'SELECT name FROM users WHERE name = 1';
    vi.mocked(llmPort.generateQuery)
      .mockResolvedValueOnce({ ...cannedLlmResponse, sql: failingSql })
      .mockResolvedValueOnce({ ...cannedLlmResponse, sql: 'DELETE FROM users' })
      .mockResolvedValueOnce(cannedLlmResponse);

    vi.mocked(tenantDatabasePort.query)
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error('invalid input syntax'))
      .mockResolvedValueOnce({ rows: [{ name: 'Alice', total: 100 }] });

    const result = await service.query({ connectionId: 'conn-1', question: 'Show top customers' });

    expect(result.attempts).toBe(3);
    expect(tenantDatabasePort.query).toHaveBeenCalledTimes(3);
  });

  it('retries on query timeout', async () => {
    vi.mocked(tenantDatabasePort.query)
      .mockResolvedValueOnce({ rows: [] })
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce({ rows: [{ name: 'Alice', total: 100 }] });

    vi.mocked(llmPort.generateQuery)
      .mockResolvedValueOnce(cannedLlmResponse)
      .mockResolvedValueOnce(cannedLlmResponse);

    const result = await service.query({ connectionId: 'conn-1', question: 'test' });

    expect(result.attempts).toBe(2);
    expect(result.rows).toEqual([{ name: 'Alice', total: 100 }]);
  }, 15000);

  it('fetches sample rows for each relevant table before building prompt', async () => {
    vi.mocked(tenantDatabasePort.query)
      .mockResolvedValueOnce({ rows: [{ name: 'Alice', total: 100 }] })
      .mockResolvedValueOnce({ rows: [{ name: 'Alice', total: 100 }] });

    await service.query({ connectionId: 'conn-1', question: 'Show top customers' });

    const calls = vi.mocked(tenantDatabasePort.query).mock.calls;
    expect(calls[0][0]).toContain('SELECT * FROM');
    expect(calls[0][0]).toContain('users');
    expect(calls[0][0]).toContain('LIMIT 5');

    const prompt = vi.mocked(llmPort.generateQuery).mock.calls[0][0];
    expect(prompt).toContain('Alice');
  });

  it('continues without sample data when sample row fetch fails', async () => {
    vi.mocked(tenantDatabasePort.query)
      .mockRejectedValueOnce(new Error('permission denied'))
      .mockResolvedValueOnce({ rows: [{ name: 'Alice', total: 100 }] });

    const result = await service.query({ connectionId: 'conn-1', question: 'Show top customers' });

    expect(result.rows).toEqual([{ name: 'Alice', total: 100 }]);
    const prompt = vi.mocked(llmPort.generateQuery).mock.calls[0][0];
    expect(prompt).not.toContain('Sample rows');
  });

  it('includes sample rows for tables that succeeded even when others fail', async () => {
    vi.mocked(schemaRetrievalPort.findRelevantColumns).mockResolvedValue([
      { tableName: 'users', columnName: 'name', dataType: 'varchar' },
      { tableName: 'orders', columnName: 'total', dataType: 'numeric' },
    ]);

    vi.mocked(tenantDatabasePort.query)
      .mockResolvedValueOnce({ rows: [{ name: 'Alice' }] })
      .mockRejectedValueOnce(new Error('orders table locked'))
      .mockResolvedValueOnce({ rows: [{ name: 'Alice', total: 100 }] });

    const result = await service.query({ connectionId: 'conn-1', question: 'Show top customers' });

    const prompt = vi.mocked(llmPort.generateQuery).mock.calls[0][0];
    expect(prompt).toContain('Alice');
    const ordersSection = prompt.split('Table: orders')[1];
    expect(ordersSection).not.toContain('Sample rows');
    expect(result.rows).toEqual([{ name: 'Alice', total: 100 }]);
  });

  it('disconnects tenant DB exactly once after retries complete', async () => {
    const failingSql = 'SELECT name FROM users WHERE name = 1';
    vi.mocked(llmPort.generateQuery)
      .mockResolvedValueOnce({ ...cannedLlmResponse, sql: failingSql })
      .mockResolvedValueOnce({ ...cannedLlmResponse, sql: failingSql })
      .mockResolvedValueOnce(cannedLlmResponse);

    vi.mocked(tenantDatabasePort.query)
      .mockRejectedValueOnce(new Error('error 1'))
      .mockRejectedValueOnce(new Error('error 2'))
      .mockResolvedValueOnce({ rows: [{ name: 'Alice', total: 100 }] });

    await service.query({ connectionId: 'conn-1', question: 'test' });

    expect(tenantDatabasePort.disconnect).toHaveBeenCalledTimes(1);
  });
});
