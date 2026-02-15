import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FetchQueryAdapter } from './fetch-query-adapter';

const cannedResponse = {
  intent: 'top_customers',
  title: 'Top Customers by Revenue',
  sql: 'SELECT name FROM customers',
  visualization: { chartType: 'bar' },
  columns: [{ name: 'name', type: 'varchar', role: 'dimension' }],
  rows: [{ name: 'Alice' }],
  attempts: 1,
};

describe('FetchQueryAdapter', () => {
  let adapter: FetchQueryAdapter;

  beforeEach(() => {
    adapter = new FetchQueryAdapter();
  });

  it('POST /api/query with correct body and returns parsed JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(cannedResponse),
    }));

    const result = await adapter.submitQuery({ connectionId: 'c1', question: 'test' });

    expect(fetch).toHaveBeenCalledWith('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId: 'c1', question: 'test' }),
    });
    expect(result).toEqual(cannedResponse);
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
    }));

    await expect(adapter.submitQuery({ connectionId: 'c1', question: 'test' }))
      .rejects.toThrow('Query failed: 400 Bad Request');
  });
});
