import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardsController } from './dashboards.controller';
import type { DashboardsService } from './dashboards.service';

describe('DashboardsController', () => {
  let controller: DashboardsController;
  let service: Pick<DashboardsService, 'createDashboard' | 'listDashboards' | 'addWidget' | 'getDashboard' | 'executeWidgetSql' | 'updateWidget' | 'removeWidget' | 'deleteDashboard'>;

  beforeEach(() => {
    service = {
      createDashboard: vi.fn(),
      listDashboards: vi.fn(),
      addWidget: vi.fn(),
      getDashboard: vi.fn(),
      executeWidgetSql: vi.fn(),
      updateWidget: vi.fn(),
      removeWidget: vi.fn(),
      deleteDashboard: vi.fn(),
    };
    controller = new DashboardsController(service as any);
  });

  it('POST /dashboards calls createDashboard and returns result', async () => {
    const created = { id: 'd1', connectionId: 'conn-1', name: 'Sales', createdAt: new Date() };
    (service.createDashboard as any).mockResolvedValue(created);

    const result = await controller.create({ connectionId: 'conn-1', name: 'Sales' });

    expect(result).toEqual(created);
    expect(service.createDashboard).toHaveBeenCalledWith({ connectionId: 'conn-1', name: 'Sales' });
  });

  it('GET /dashboards?connectionId=xxx calls listDashboards', async () => {
    const dashboards = [{ id: 'd1', name: 'Sales', widgetCount: 2, createdAt: new Date() }];
    (service.listDashboards as any).mockResolvedValue(dashboards);

    const result = await controller.list('conn-1');

    expect(result).toEqual(dashboards);
    expect(service.listDashboards).toHaveBeenCalledWith('conn-1');
  });

  it('POST /dashboards/:id/widgets calls addWidget and returns result', async () => {
    const widget = {
      id: 'w1', dashboardId: 'd1', title: 'Revenue', sql: 'SELECT 1',
      chartType: 'bar', columns: [], position: 0, createdAt: new Date(),
    };
    (service.addWidget as any).mockResolvedValue(widget);

    const body = { title: 'Revenue', sql: 'SELECT 1', chartType: 'bar', columns: [] };
    const result = await controller.addWidget('d1', body);

    expect(result).toEqual(widget);
    expect(service.addWidget).toHaveBeenCalledWith('d1', body);
  });

  it('GET /dashboards/:id calls getDashboard', async () => {
    const dashboard = { id: 'd1', name: 'Sales', widgets: [] };
    (service.getDashboard as any).mockResolvedValue(dashboard);

    const result = await controller.getDashboard('d1');

    expect(result).toEqual(dashboard);
    expect(service.getDashboard).toHaveBeenCalledWith('d1');
  });

  it('POST /dashboards/:dashboardId/widgets/:widgetId/execute calls executeWidgetSql', async () => {
    const executionResult = { columns: [{ name: 'name', type: 'varchar', role: 'dimension' }], rows: [{ name: 'Alice' }] };
    (service.executeWidgetSql as any).mockResolvedValue(executionResult);

    const result = await controller.executeWidget('d1', 'w1');

    expect(result).toEqual(executionResult);
    expect(service.executeWidgetSql).toHaveBeenCalledWith('d1', 'w1');
  });

  it('DELETE /dashboards/:id/widgets/:widgetId calls removeWidget', async () => {
    (service.removeWidget as any).mockResolvedValue(undefined);

    await controller.removeWidget('d1', 'w1');

    expect(service.removeWidget).toHaveBeenCalledWith('d1', 'w1');
  });

  it('PATCH /dashboards/:id/widgets/:widgetId calls updateWidget and returns result', async () => {
    const updated = {
      id: 'w1', dashboardId: 'd1', title: 'New Title', sql: 'SELECT 1',
      chartType: 'bar', columns: [], legendLabels: { revenue: 'Monthly Revenue' },
      position: 0, createdAt: new Date(),
    };
    (service.updateWidget as any).mockResolvedValue(updated);

    const body = { title: 'New Title', legendLabels: { revenue: 'Monthly Revenue' } };
    const result = await controller.updateWidget('d1', 'w1', body);

    expect(result).toEqual(updated);
    expect(service.updateWidget).toHaveBeenCalledWith('d1', 'w1', body);
  });

  it('PATCH with empty body throws BadRequestException', () => {
    expect(() => controller.updateWidget('d1', 'w1', {})).toThrow('At least one field must be provided');
  });

  it('DELETE /dashboards/:id calls deleteDashboard', async () => {
    (service.deleteDashboard as any).mockResolvedValue(undefined);

    await controller.deleteDashboard('d1');

    expect(service.deleteDashboard).toHaveBeenCalledWith('d1');
  });
});