import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkspace } from './useWorkspace';
import type { QueryPort } from '../ports/query-port';
import type { QueryResponse } from '../domain/query-types';

const cannedResponse: QueryResponse = {
  intent: 'top_customers',
  title: 'Top Customers by Revenue',
  sql: 'SELECT name FROM customers',
  visualization: { chartType: 'bar' },
  columns: [{ name: 'name', type: 'varchar', role: 'dimension' }],
  rows: [{ name: 'Alice' }],
  attempts: 1,
};

describe('useWorkspace', () => {
  it('submitQuery calls port and sets response', async () => {
    const port: QueryPort = {
      submitQuery: vi.fn().mockResolvedValue(cannedResponse),
    };

    const { result } = renderHook(() => useWorkspace(port));

    expect(result.current.response).toBeNull();
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      await result.current.submit('conn-1', 'Show top customers');
    });

    expect(port.submitQuery).toHaveBeenCalledWith({
      connectionId: 'conn-1',
      question: 'Show top customers',
    });
    expect(result.current.response).toEqual(cannedResponse);
    expect(result.current.isLoading).toBe(false);
  });

  it('sets error when port rejects', async () => {
    const port: QueryPort = {
      submitQuery: vi.fn().mockRejectedValue(new Error('ANTHROPIC_API_KEY is not configured')),
    };

    const { result } = renderHook(() => useWorkspace(port));

    await act(async () => {
      await result.current.submit('conn-1', 'test');
    });

    expect(result.current.error).toBe('ANTHROPIC_API_KEY is not configured');
    expect(result.current.response).toBeNull();
  });
});
