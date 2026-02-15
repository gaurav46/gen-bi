import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QueryController } from './query.controller';
import type { QueryService } from './query.service';
import type { QueryResponse } from './query.types';

const cannedResponse: QueryResponse = {
  intent: 'top_customers',
  title: 'Top Customers by Revenue',
  sql: 'SELECT name, SUM(total) FROM customers GROUP BY name ORDER BY SUM(total) DESC LIMIT 10',
  columns: [
    { name: 'name', type: 'varchar', role: 'dimension' },
    { name: 'total', type: 'numeric', role: 'measure' },
  ],
  rows: [{ name: 'Alice', total: 500 }, { name: 'Bob', total: 300 }],
  attempts: 1,
};

describe('QueryController', () => {
  let controller: QueryController;
  let queryService: Pick<QueryService, 'query'>;

  beforeEach(() => {
    queryService = {
      query: vi.fn().mockResolvedValue(cannedResponse),
    };
    controller = new QueryController(queryService as QueryService);
  });

  it('POST /api/query delegates to QueryService and returns result', async () => {
    const body = { connectionId: 'conn-1', question: 'Show top customers' };
    const result = await controller.query(body);

    expect(queryService.query).toHaveBeenCalledWith(body);
    expect(result).toEqual(cannedResponse);
  });

  it('POST /api/query returns rows in response on success', async () => {
    const result = await controller.query({ connectionId: 'conn-1', question: 'test' });

    expect(result.rows).toEqual([{ name: 'Alice', total: 500 }, { name: 'Bob', total: 300 }]);
    expect(result.attempts).toBe(1);
  });

  it('propagates NotFoundException from service', async () => {
    vi.mocked(queryService.query).mockRejectedValue(
      new NotFoundException('Connection config conn-1 not found'),
    );

    await expect(controller.query({ connectionId: 'conn-1', question: 'test' }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('propagates LLM configuration errors', async () => {
    vi.mocked(queryService.query).mockRejectedValue(
      new BadRequestException('ANTHROPIC_API_KEY is not configured'),
    );

    await expect(controller.query({ connectionId: 'conn-1', question: 'test' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('POST /api/query returns 400 when no embeddings exist', async () => {
    vi.mocked(queryService.query).mockRejectedValue(
      new BadRequestException('No embeddings found for this connection'),
    );

    await expect(controller.query({ connectionId: 'conn-1', question: 'test' }))
      .rejects.toThrow('No embeddings found');
  });

  it('POST /api/query returns 400 when SQL validation fails', async () => {
    vi.mocked(queryService.query).mockRejectedValue(
      new BadRequestException('SQL validation failed: Forbidden keyword detected: DELETE'),
    );

    await expect(controller.query({ connectionId: 'conn-1', question: 'test' }))
      .rejects.toThrow('SQL validation failed');
  });
});
