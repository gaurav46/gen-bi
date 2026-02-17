import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { DashboardsService } from './dashboards.service';

describe('Dashboards Integration', () => {
  let service: DashboardsService;
  let prisma: any;
  let connectionsService: any;
  let tenantDatabasePort: any;

  beforeEach(() => {
    prisma = {
      dashboard: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        delete: vi.fn(),
      },
      widget: {
        create: vi.fn(),
        count: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    connectionsService = {
      getTenantConnectionConfig: vi.fn(),
    };
    tenantDatabasePort = {
      connect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn(),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
    service = new DashboardsService(prisma, connectionsService, tenantDatabasePort);
  });

  it('create dashboard, list dashboards, add widget', async () => {
    const createdDashboard = {
      id: 'd1',
      connectionId: 'conn-1',
      name: 'Sales KPIs',
      createdAt: new Date('2025-01-01'),
    };
    prisma.dashboard.create.mockResolvedValue(createdDashboard);

    const dashboard = await service.createDashboard({
      connectionId: 'conn-1',
      name: 'Sales KPIs',
    });

    expect(dashboard).toEqual(createdDashboard);
    expect(prisma.dashboard.create).toHaveBeenCalledWith({
      data: { connectionId: 'conn-1', name: 'Sales KPIs' },
    });

    prisma.dashboard.findMany.mockResolvedValue([
      { ...createdDashboard, _count: { widgets: 0 } },
    ]);

    const dashboards = await service.listDashboards('conn-1');

    expect(dashboards).toEqual([
      {
        id: 'd1',
        name: 'Sales KPIs',
        widgetCount: 0,
        createdAt: createdDashboard.createdAt,
      },
    ]);

    const columns = [
      { name: 'name', type: 'varchar', role: 'dimension' },
      { name: 'revenue', type: 'numeric', role: 'measure' },
    ];
    const createdWidget = {
      id: 'w1',
      dashboardId: 'd1',
      title: 'Top Customers',
      sql: 'SELECT name, revenue FROM customers',
      chartType: 'bar',
      columns,
      position: 0,
      createdAt: new Date('2025-01-01'),
    };

    prisma.widget.count.mockResolvedValue(0);
    prisma.widget.create.mockResolvedValue(createdWidget);

    const widget = await service.addWidget('d1', {
      title: 'Top Customers',
      sql: 'SELECT name, revenue FROM customers',
      chartType: 'bar',
      columns,
    });

    expect(widget).toEqual(createdWidget);
    expect(widget.position).toBe(0);
    expect(prisma.widget.count).toHaveBeenCalledWith({
      where: { dashboardId: 'd1' },
    });
  });

  it('getDashboard returns dashboard with widgets', async () => {
    const dashboard = {
      id: 'd1',
      name: 'Sales KPIs',
      widgets: [
        { id: 'w1', title: 'Revenue', sql: 'SELECT 1', chartType: 'bar', columns: [], position: 0 },
      ],
    };
    prisma.dashboard.findUniqueOrThrow.mockResolvedValue(dashboard);

    const result = await service.getDashboard('d1');

    expect(result).toEqual(dashboard);
    expect(prisma.dashboard.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'd1' },
      include: { widgets: { orderBy: { position: 'asc' } } },
    });
  });

  it('getDashboard throws NotFoundException for missing dashboard', async () => {
    prisma.dashboard.findUniqueOrThrow.mockRejectedValue({ name: 'NotFoundError' });

    await expect(service.getDashboard('missing')).rejects.toThrow(NotFoundException);
  });

  it('executeWidgetSql connects to tenant DB, runs widget SQL, returns result', async () => {
    prisma.widget.findUniqueOrThrow.mockResolvedValue({
      id: 'w1',
      sql: 'SELECT name FROM users',
      columns: [{ name: 'name', type: 'varchar', role: 'dimension' }],
      dashboard: { connectionId: 'conn-1' },
    });
    connectionsService.getTenantConnectionConfig.mockResolvedValue({
      host: 'localhost', port: 5432, database: 'testdb', username: 'user', password: 'pass',
    });
    tenantDatabasePort.query.mockResolvedValue({ rows: [{ name: 'Alice' }] });

    const result = await service.executeWidgetSql('d1', 'w1');

    expect(tenantDatabasePort.connect).toHaveBeenCalledWith({
      host: 'localhost', port: 5432, database: 'testdb', username: 'user', password: 'pass',
    });
    expect(tenantDatabasePort.query).toHaveBeenCalledWith('SELECT name FROM users');
    expect(tenantDatabasePort.disconnect).toHaveBeenCalled();
    expect(result).toEqual({
      columns: [{ name: 'name', type: 'varchar', role: 'dimension' }],
      rows: [{ name: 'Alice' }],
    });
  });

  it('executeWidgetSql calls disconnect even when query fails', async () => {
    prisma.widget.findUniqueOrThrow.mockResolvedValue({
      id: 'w1',
      sql: 'SELECT bad FROM missing',
      columns: [],
      dashboard: { connectionId: 'conn-1' },
    });
    connectionsService.getTenantConnectionConfig.mockResolvedValue({
      host: 'localhost', port: 5432, database: 'testdb', username: 'user', password: 'pass',
    });
    tenantDatabasePort.query.mockRejectedValue(new Error('relation not found'));

    await expect(service.executeWidgetSql('d1', 'w1')).rejects.toThrow('relation not found');
    expect(tenantDatabasePort.disconnect).toHaveBeenCalled();
  });

  it('updateWidget updates title and legendLabels', async () => {
    const updated = {
      id: 'w1', dashboardId: 'd1', title: 'New Title', sql: 'SELECT 1',
      chartType: 'bar', columns: [], legendLabels: { revenue: 'Monthly Revenue' },
      position: 0, createdAt: new Date(),
    };
    prisma.widget.update.mockResolvedValue(updated);

    const result = await service.updateWidget('d1', 'w1', {
      title: 'New Title',
      legendLabels: { revenue: 'Monthly Revenue' },
    });

    expect(result).toEqual(updated);
    expect(prisma.widget.update).toHaveBeenCalledWith({
      where: { id: 'w1', dashboardId: 'd1' },
      data: { title: 'New Title', legendLabels: { revenue: 'Monthly Revenue' } },
    });
  });

  it('updateWidget throws NotFoundException when widget does not exist', async () => {
    const prismaError = new Error('Record not found');
    (prismaError as any).code = 'P2025';
    prisma.widget.update.mockRejectedValue(prismaError);

    await expect(service.updateWidget('d1', 'missing', { title: 'X' })).rejects.toThrow(NotFoundException);
  });

  it('removeWidget deletes the widget', async () => {
    prisma.widget.delete.mockResolvedValue(undefined);

    await service.removeWidget('d1', 'w1');

    expect(prisma.widget.delete).toHaveBeenCalledWith({
      where: { id: 'w1', dashboardId: 'd1' },
    });
  });

  it('deleteDashboard deletes the dashboard', async () => {
    prisma.dashboard.delete.mockResolvedValue(undefined);

    await service.deleteDashboard('d1');

    expect(prisma.dashboard.delete).toHaveBeenCalledWith({
      where: { id: 'd1' },
    });
  });
});
