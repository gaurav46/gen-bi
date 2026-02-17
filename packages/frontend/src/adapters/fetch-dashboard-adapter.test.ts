import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FetchDashboardAdapter } from './fetch-dashboard-adapter';

describe('FetchDashboardAdapter', () => {
  let adapter: FetchDashboardAdapter;

  beforeEach(() => {
    adapter = new FetchDashboardAdapter();
  });

  it('listDashboards calls GET /api/dashboards with connectionId', async () => {
    const dashboards = [{ id: 'd1', name: 'Sales', widgetCount: 2, createdAt: '2025-01-01' }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(dashboards),
    }));

    const result = await adapter.listDashboards('conn-1');

    expect(fetch).toHaveBeenCalledWith('/api/dashboards?connectionId=conn-1');
    expect(result).toEqual(dashboards);
  });

  it('createDashboard calls POST /api/dashboards with body', async () => {
    const created = { id: 'd1', name: 'Sales', widgetCount: 0, createdAt: '2025-01-01' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(created),
    }));

    const result = await adapter.createDashboard({ connectionId: 'conn-1', name: 'Sales' });

    expect(fetch).toHaveBeenCalledWith('/api/dashboards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId: 'conn-1', name: 'Sales' }),
    });
    expect(result).toEqual(created);
  });

  it('addWidget calls POST /api/dashboards/:id/widgets with body', async () => {
    const widget = { id: 'w1', dashboardId: 'd1', title: 'Rev', sql: 'SELECT 1', chartType: 'bar', columns: [], position: 0, createdAt: '2025-01-01' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(widget),
    }));

    const request = { title: 'Rev', sql: 'SELECT 1', chartType: 'bar', columns: [] };
    const result = await adapter.addWidget('d1', request);

    expect(fetch).toHaveBeenCalledWith('/api/dashboards/d1/widgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    expect(result).toEqual(widget);
  });

  it('getDashboard calls GET /api/dashboards/:id', async () => {
    const detail = { id: 'd1', name: 'Sales', widgets: [] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(detail),
    }));

    const result = await adapter.getDashboard('d1');

    expect(fetch).toHaveBeenCalledWith('/api/dashboards/d1');
    expect(result).toEqual(detail);
  });

  it('executeWidget calls POST /api/dashboards/:dashboardId/widgets/:widgetId/execute', async () => {
    const executionResult = { columns: [{ name: 'name', type: 'varchar', role: 'dimension' }], rows: [{ name: 'Alice' }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(executionResult),
    }));

    const result = await adapter.executeWidget('d1', 'w1');

    expect(fetch).toHaveBeenCalledWith('/api/dashboards/d1/widgets/w1/execute', { method: 'POST' });
    expect(result).toEqual(executionResult);
  });

  it('removeWidget calls DELETE /api/dashboards/:id/widgets/:widgetId', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    await adapter.removeWidget('d1', 'w1');

    expect(fetch).toHaveBeenCalledWith('/api/dashboards/d1/widgets/w1', { method: 'DELETE' });
  });

  it('deleteDashboard calls DELETE /api/dashboards/:id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    await adapter.deleteDashboard('d1');

    expect(fetch).toHaveBeenCalledWith('/api/dashboards/d1', { method: 'DELETE' });
  });

  it('updateWidget calls PATCH /api/dashboards/:id/widgets/:widgetId with body', async () => {
    const updated = { id: 'w1', dashboardId: 'd1', title: 'New', sql: 'SELECT 1', chartType: 'bar', columns: [], legendLabels: { revenue: 'Rev' }, position: 0, createdAt: '2025-01-01' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(updated),
    }));

    const result = await adapter.updateWidget('d1', 'w1', { title: 'New', legendLabels: { revenue: 'Rev' } });

    expect(fetch).toHaveBeenCalledWith('/api/dashboards/d1/widgets/w1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New', legendLabels: { revenue: 'Rev' } }),
    });
    expect(result).toEqual(updated);
  });

  it('throws when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    }));

    await expect(adapter.listDashboards('conn-1')).rejects.toThrow('500');
  });
});
