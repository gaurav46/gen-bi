import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSchemaAnalysis } from './useSchemaAnalysis';
import { deferred } from './test-helpers';

describe('useSchemaAnalysis', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('exposes current and total from poll response during analysis', async () => {
    const analyzeDeferred = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ schemas: ['public'] }),
      })
      .mockImplementationOnce(() => analyzeDeferred.promise)
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'analyzing', current: 3, total: 12, message: 'Analyzing orders' }),
      });
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => useSchemaAnalysis());

    await act(async () => {
      await result.current.discoverSchemas('conn-id');
    });

    act(() => {
      result.current.toggleSchema('public', true);
    });

    await act(async () => {
      result.current.analyze();
    });

    await waitFor(() => {
      expect(result.current.current).toBe(3);
      expect(result.current.total).toBe(12);
    });

    analyzeDeferred.resolve({ ok: true, json: () => Promise.resolve({}) });
  });

  it('resetConnection resets all state to idle', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ schemas: ['public', 'sales'] }),
      });
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => useSchemaAnalysis());

    await act(async () => {
      await result.current.discoverSchemas('conn-id');
    });

    expect(result.current.status).toBe('ready');
    expect(result.current.discoveredSchemas).toEqual(['public', 'sales']);

    act(() => {
      result.current.resetConnection();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.discoveredSchemas).toEqual([]);
    expect(result.current.selectedSchemas).toEqual([]);
    expect(result.current.errorMessage).toBe('');
    expect(result.current.analysisMessage).toBe('');
    expect(result.current.current).toBe(0);
    expect(result.current.total).toBe(0);
    expect(localStorage.getItem('connectionId')).toBeNull();
  });

  it('recovers analyzing state on mount when connectionId exists', async () => {
    localStorage.setItem('connectionId', 'saved-conn');
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'analyzing', current: 5, total: 10, message: 'Analyzing users' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => useSchemaAnalysis());

    await waitFor(() => {
      expect(result.current.status).toBe('analyzing');
    });

    expect(result.current.current).toBe(5);
    expect(result.current.total).toBe(10);
    expect(result.current.analysisMessage).toBe('Analyzing users');
  });

  it('stays idle when mount status check fails with network error', async () => {
    localStorage.setItem('connectionId', 'saved-conn');
    const fetchSpy = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => useSchemaAnalysis());

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    expect(result.current.status).toBe('idle');
  });

  it('stays idle when mount status check returns idle', async () => {
    localStorage.setItem('connectionId', 'saved-conn');
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'idle' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => useSchemaAnalysis());

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    expect(result.current.status).toBe('idle');
  });

  it('resumes polling after mount recovery detects analyzing', async () => {
    vi.useFakeTimers();
    localStorage.setItem('connectionId', 'saved-conn');

    let callCount = 0;
    const fetchSpy = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'analyzing', current: 5, total: 10, message: 'Analyzing users' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'done', current: 10, total: 10, message: 'Complete' }),
      });
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => useSchemaAnalysis());

    await vi.waitFor(() => {
      expect(result.current.status).toBe('analyzing');
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    await vi.waitFor(() => {
      expect(result.current.status).toBe('done');
    });

    vi.useRealTimers();
  });

  it('transitions to introspected when poll detects introspected status', async () => {
    const analyzeDeferred = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ schemas: ['public'] }),
      })
      .mockImplementationOnce(() => analyzeDeferred.promise)
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'introspected', current: 5, total: 5, message: 'Introspection complete' }),
      });
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => useSchemaAnalysis());

    await act(async () => {
      await result.current.discoverSchemas('conn-id');
    });
    act(() => {
      result.current.toggleSchema('public', true);
    });
    await act(async () => {
      result.current.analyze();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('introspected');
    });

    analyzeDeferred.resolve({ ok: true, json: () => Promise.resolve({}) });
  });

  it('fetches annotations when status transitions to introspected', async () => {
    const cannedAnnotations = {
      columns: [
        { columnId: 'col-1', tableName: 'orders', schemaName: 'public', columnName: 'amt_1', dataType: 'numeric', suggestedDescription: 'Order subtotal amount' },
      ],
    };
    const analyzeDeferred = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    let fetchCallIndex = 0;
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      fetchCallIndex++;
      if (url.includes('/test')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ schemas: ['public'] }) });
      }
      if (url.includes('/discover') && !url.includes('/status')) {
        return analyzeDeferred.promise;
      }
      if (url.includes('/annotations')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(cannedAnnotations) });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'introspected', current: 2, total: 2, message: 'Introspection complete' }),
      });
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => useSchemaAnalysis());

    await act(async () => {
      await result.current.discoverSchemas('conn-id');
    });
    act(() => {
      result.current.toggleSchema('public', true);
    });
    await act(async () => {
      result.current.analyze();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('introspected');
    });

    analyzeDeferred.resolve({ ok: true, json: () => Promise.resolve({}) });

    await waitFor(() => {
      expect(result.current.annotations).toEqual(cannedAnnotations.columns);
    });
  });

  it('recovers done state on mount when connectionId exists', async () => {
    localStorage.setItem('connectionId', 'saved-conn');
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'done', current: 10, total: 10, message: 'Complete' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => useSchemaAnalysis());

    await waitFor(() => {
      expect(result.current.status).toBe('done');
    });

    expect(result.current.current).toBe(10);
    expect(result.current.total).toBe(10);
  });

  it('saveAndEmbed sends PATCH then POST embed and transitions to embedding', async () => {
    vi.useFakeTimers();
    const fetchCalls: string[] = [];
    const fetchSpy = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      const method = options?.method ?? 'GET';
      fetchCalls.push(`${method} ${url}`);
      if (url.includes('/test')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ schemas: ['public'] }) });
      }
      if (url.includes('/discover') && !url.includes('/status')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ tablesDiscovered: 2 }) });
      }
      if (url.includes('/annotations') && method === 'GET') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            columns: [{ columnId: 'col-1', tableName: 'orders', schemaName: 'public', columnName: 'amt_1', dataType: 'numeric', suggestedDescription: 'Amount' }],
          }),
        });
      }
      if (url.includes('/annotations') && method === 'PATCH') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ updated: 1 }) });
      }
      if (url.includes('/embed')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'started' }) });
      }
      if (url.includes('/status')) {
        if (fetchCalls.filter((c) => c.includes('/status')).length <= 2) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'introspected', current: 2, total: 2, message: '' }) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'done', current: 2, total: 2, message: 'Analysis complete' }) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => useSchemaAnalysis());

    await act(async () => {
      await result.current.discoverSchemas('conn-id');
    });
    act(() => {
      result.current.toggleSchema('public', true);
    });
    await act(async () => {
      result.current.analyze();
    });

    await vi.waitFor(() => {
      expect(result.current.status).toBe('introspected');
    });

    await vi.waitFor(() => {
      expect(result.current.annotations).toHaveLength(1);
    });

    await act(async () => {
      await result.current.saveAndEmbed([{ columnId: 'col-1', description: 'Order subtotal' }]);
    });

    expect(result.current.status).toBe('embedding');
    expect(fetchCalls).toContain('PATCH /api/schema/conn-id/annotations');
    expect(fetchCalls).toContain('POST /api/schema/conn-id/embed');

    const patchIndex = fetchCalls.indexOf('PATCH /api/schema/conn-id/annotations');
    const embedIndex = fetchCalls.indexOf('POST /api/schema/conn-id/embed');
    expect(patchIndex).toBeLessThan(embedIndex);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    await vi.waitFor(() => {
      expect(result.current.status).toBe('done');
    });

    vi.useRealTimers();
  });

  it('skipAnnotations posts embed without saving annotations', async () => {
    vi.useFakeTimers();
    const fetchCalls: string[] = [];
    const fetchSpy = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      const method = options?.method ?? 'GET';
      fetchCalls.push(`${method} ${url}`);
      if (url.includes('/test')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ schemas: ['public'] }) });
      }
      if (url.includes('/discover') && !url.includes('/status')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ tablesDiscovered: 2 }) });
      }
      if (url.includes('/annotations') && method === 'GET') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            columns: [{ columnId: 'col-1', tableName: 'orders', schemaName: 'public', columnName: 'amt_1', dataType: 'numeric', suggestedDescription: 'Amount' }],
          }),
        });
      }
      if (url.includes('/embed')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'started' }) });
      }
      if (url.includes('/status')) {
        if (fetchCalls.filter((c) => c.includes('/status')).length <= 2) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'introspected', current: 2, total: 2, message: '' }) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'done', current: 2, total: 2, message: 'Analysis complete' }) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => useSchemaAnalysis());

    await act(async () => {
      await result.current.discoverSchemas('conn-id');
    });
    act(() => {
      result.current.toggleSchema('public', true);
    });
    await act(async () => {
      result.current.analyze();
    });

    await vi.waitFor(() => {
      expect(result.current.status).toBe('introspected');
    });
    await vi.waitFor(() => {
      expect(result.current.annotations).toHaveLength(1);
    });

    await act(async () => {
      await result.current.skipAnnotations();
    });

    expect(result.current.status).toBe('embedding');
    expect(fetchCalls).not.toContain('PATCH /api/schema/conn-id/annotations');
    expect(fetchCalls).toContain('POST /api/schema/conn-id/embed');

    vi.useRealTimers();
  });
});
