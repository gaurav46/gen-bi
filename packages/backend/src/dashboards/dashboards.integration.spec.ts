import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { DashboardsService } from './dashboards.service';
import { DRIZZLE_CLIENT } from '../infrastructure/drizzle/client';
import { Test, TestingModule } from '@nestjs/testing';

const returningMock = vi.fn();
const selectFromWhereOrderByMock = vi.fn();
const selectFromWhereMock = vi.fn();
const selectFromMock = vi.fn();
const updateSetWhereReturningMock = vi.fn();
const deleteWhereMock = vi.fn();

function makeInsertMock() {
  return vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: returningMock,
    }),
  });
}

function makeSelectMock(whereResult: unknown[] = [], orderByResult: unknown[] = []) {
  return vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(orderByResult),
      }),
    }),
  });
}

let mockDb: any;

function buildMockDb() {
  return {
    insert: makeInsertMock(),
    select: vi.fn(),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: updateSetWhereReturningMock,
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: deleteWhereMock,
    }),
  };
}

describe('Dashboards Integration', () => {
  let service: DashboardsService;
  let connectionsService: any;
  let tenantDatabasePort: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockDb = buildMockDb();

    connectionsService = {
      getTenantConnectionConfig: vi.fn(),
    };
    tenantDatabasePort = {
      systemSchemaNames: new Set<string>(),
      connect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn(),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardsService,
        { provide: DRIZZLE_CLIENT, useValue: mockDb },
        { provide: 'ConnectionsService', useValue: connectionsService },
        { provide: 'TENANT_DATABASE_PORT', useValue: tenantDatabasePort },
      ],
    })
      .overrideProvider('ConnectionsService')
      .useValue(connectionsService)
      .overrideProvider('TENANT_DATABASE_PORT')
      .useValue(tenantDatabasePort)
      .compile();

    service = new DashboardsService(mockDb, connectionsService, tenantDatabasePort);
  });

  it('createDashboard inserts a row and returns it', async () => {
    const now = new Date('2025-01-01');
    const inserted = { id: 'd1', connectionId: 'conn-1', name: 'Sales KPIs', createdAt: now, updatedAt: now };
    returningMock.mockResolvedValue([inserted]);

    const result = await service.createDashboard({ connectionId: 'conn-1', name: 'Sales KPIs' });

    expect(mockDb.insert).toHaveBeenCalled();
    expect(result).toEqual(inserted);
  });

  it('listDashboards returns summaries with widget counts', async () => {
    const now = new Date('2025-01-01');
    const dashboard = { id: 'd1', connectionId: 'conn-1', name: 'Sales KPIs', createdAt: now, updatedAt: now };

    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([dashboard]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        }),
      });

    const result = await service.listDashboards('conn-1');

    expect(result).toEqual([
      { id: 'd1', name: 'Sales KPIs', widgetCount: 2, createdAt: now },
    ]);
  });

  it('listDashboards returns empty array when no dashboards exist', async () => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const result = await service.listDashboards('conn-1');

    expect(result).toEqual([]);
  });

  it('getDashboard returns dashboard with deserialized widgets ordered by position', async () => {
    const now = new Date('2025-01-01');
    const columns = [{ name: 'name', type: 'varchar', role: 'dimension' }];
    const dashboard = { id: 'd1', name: 'Sales KPIs', connectionId: 'conn-1', createdAt: now, updatedAt: now };
    const widgetRow = {
      id: 'w1', dashboardId: 'd1', title: 'Revenue', sql: 'SELECT 1',
      chartType: 'bar', columns: JSON.stringify(columns), legendLabels: null, position: 0,
      createdAt: now, updatedAt: now,
    };

    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([dashboard]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([widgetRow]),
          }),
        }),
      });

    const result = await service.getDashboard('d1');

    expect(result.id).toBe('d1');
    expect(result.widgets).toHaveLength(1);
    expect(result.widgets[0].columns).toEqual(columns);
    expect(result.widgets[0].legendLabels).toBeNull();
  });

  it('getDashboard throws NotFoundException for missing dashboard', async () => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    await expect(service.getDashboard('missing')).rejects.toThrow(NotFoundException);
  });

  it('addWidget counts existing widgets for position and inserts serialized columns', async () => {
    const now = new Date('2025-01-01');
    const columns = [{ name: 'name', type: 'varchar', role: 'dimension' }];

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 2 }]),
      }),
    });

    const insertedRow = {
      id: 'w1', dashboardId: 'd1', title: 'Top Customers',
      sql: 'SELECT name FROM customers', chartType: 'bar',
      columns: JSON.stringify(columns), legendLabels: null,
      position: 2, createdAt: now, updatedAt: now,
    };
    returningMock.mockResolvedValue([insertedRow]);

    const result = await service.addWidget('d1', {
      title: 'Top Customers',
      sql: 'SELECT name FROM customers',
      chartType: 'bar',
      columns,
    });

    expect(mockDb.insert).toHaveBeenCalled();
    const valuesCall = mockDb.insert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith(
      expect.objectContaining({
        dashboardId: 'd1',
        position: 2,
        columns: JSON.stringify(columns),
      }),
    );
    expect(result.columns).toEqual(columns);
    expect(result.position).toBe(2);
  });

  it('addWidget passes legendLabels as null in the insert values', async () => {
    const columns = [{ name: 'revenue', type: 'numeric', role: 'measure' }];

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      }),
    });

    const now = new Date('2025-01-01');
    const insertedRow = {
      id: 'w2', dashboardId: 'd1', title: 'Revenue',
      sql: 'SELECT revenue FROM sales', chartType: 'line',
      columns: JSON.stringify(columns), legendLabels: null,
      position: 0, createdAt: now, updatedAt: now,
    };
    returningMock.mockResolvedValue([insertedRow]);

    await service.addWidget('d1', {
      title: 'Revenue',
      sql: 'SELECT revenue FROM sales',
      chartType: 'line',
      columns,
    });

    const valuesCall = mockDb.insert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith(
      expect.objectContaining({ legendLabels: null }),
    );
  });

  it('getDashboard deserializes non-null legendLabels JSON string into an object', async () => {
    const now = new Date('2025-01-01');
    const legendLabels = { revenue: 'Monthly Revenue', cost: 'Monthly Cost' };
    const columns = [{ name: 'revenue', type: 'numeric', role: 'measure' }];
    const dashboard = { id: 'd2', name: 'Financials', connectionId: 'conn-1', createdAt: now, updatedAt: now };
    const widgetRow = {
      id: 'w3', dashboardId: 'd2', title: 'Revenue vs Cost', sql: 'SELECT 1',
      chartType: 'line', columns: JSON.stringify(columns),
      legendLabels: JSON.stringify(legendLabels),
      position: 0, createdAt: now, updatedAt: now,
    };

    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([dashboard]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([widgetRow]),
          }),
        }),
      });

    const result = await service.getDashboard('d2');

    expect(result.widgets).toHaveLength(1);
    expect(result.widgets[0].legendLabels).toEqual(legendLabels);
    expect(result.widgets[0].columns).toEqual(columns);
  });

  it('updateWidget updates row and deserializes result', async () => {
    const now = new Date();
    const updatedRow = {
      id: 'w1', dashboardId: 'd1', title: 'New Title', sql: 'SELECT 1',
      chartType: 'bar', columns: JSON.stringify([]), legendLabels: JSON.stringify({ revenue: 'Monthly Revenue' }),
      position: 0, createdAt: now, updatedAt: now,
    };
    updateSetWhereReturningMock.mockResolvedValue([updatedRow]);

    const result = await service.updateWidget('d1', 'w1', {
      title: 'New Title',
      legendLabels: { revenue: 'Monthly Revenue' },
    });

    expect(mockDb.update).toHaveBeenCalled();
    expect(result.title).toBe('New Title');
    expect(result.legendLabels).toEqual({ revenue: 'Monthly Revenue' });
  });

  it('updateWidget throws NotFoundException when widgetId/dashboardId does not match', async () => {
    updateSetWhereReturningMock.mockResolvedValue([]);

    await expect(service.updateWidget('d1', 'missing', { title: 'X' })).rejects.toThrow(NotFoundException);
  });

  it('removeWidget deletes the widget row', async () => {
    deleteWhereMock.mockResolvedValue(undefined);

    await service.removeWidget('d1', 'w1');

    expect(mockDb.delete).toHaveBeenCalled();
  });

  it('deleteDashboard deletes the dashboard row', async () => {
    deleteWhereMock.mockResolvedValue(undefined);

    await service.deleteDashboard('d1');

    expect(mockDb.delete).toHaveBeenCalled();
  });

  it('executeWidgetSql connects to tenant DB, runs widget SQL, returns result', async () => {
    const now = new Date();
    const columns = [{ name: 'name', type: 'varchar', role: 'dimension' }];
    const widgetRow = {
      id: 'w1', dashboardId: 'd1', sql: 'SELECT name FROM users',
      title: 'Test', chartType: 'bar', columns: JSON.stringify(columns), legendLabels: null,
      position: 0, createdAt: now, updatedAt: now,
    };

    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([widgetRow]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ connectionId: 'conn-1' }]),
        }),
      });

    connectionsService.getTenantConnectionConfig.mockResolvedValue({
      host: 'localhost', port: 5432, database: 'testdb', username: 'user', password: 'pass',
      dbType: 'postgresql' as const,
    });
    tenantDatabasePort.query.mockResolvedValue({ rows: [{ name: 'Alice' }] });

    const result = await service.executeWidgetSql('d1', 'w1');

    expect(tenantDatabasePort.connect).toHaveBeenCalledWith({
      host: 'localhost', port: 5432, database: 'testdb', username: 'user', password: 'pass',
      dbType: 'postgresql',
    });
    expect(tenantDatabasePort.query).toHaveBeenCalledWith('SELECT name FROM users');
    expect(tenantDatabasePort.disconnect).toHaveBeenCalled();
    expect(result).toEqual({ columns, rows: [{ name: 'Alice' }] });
  });

  it('executeWidgetSql calls disconnect even when query fails', async () => {
    const now = new Date();
    const widgetRow = {
      id: 'w1', dashboardId: 'd1', sql: 'SELECT bad FROM missing',
      title: 'Test', chartType: 'bar', columns: JSON.stringify([]), legendLabels: null,
      position: 0, createdAt: now, updatedAt: now,
    };

    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([widgetRow]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ connectionId: 'conn-1' }]),
        }),
      });

    connectionsService.getTenantConnectionConfig.mockResolvedValue({
      host: 'localhost', port: 5432, database: 'testdb', username: 'user', password: 'pass',
      dbType: 'postgresql' as const,
    });
    tenantDatabasePort.query.mockRejectedValue(new Error('relation not found'));

    await expect(service.executeWidgetSql('d1', 'w1')).rejects.toThrow('relation not found');
    expect(tenantDatabasePort.disconnect).toHaveBeenCalled();
  });
});
