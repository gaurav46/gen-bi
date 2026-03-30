import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, count, asc, desc } from 'drizzle-orm';
import { ConnectionsService } from '../connections/connections.service';
import type { TenantDatabasePort } from '../schema-discovery/tenant-database.port';
import { TENANT_DATABASE_PORT } from '../schema-discovery/schema-discovery.service';
import { DRIZZLE_CLIENT, AppDatabase } from '../infrastructure/drizzle/client';
import * as tables from '../infrastructure/drizzle/schema';
import type { CreateDashboardDto, CreateWidgetDto, UpdateWidgetDto, DashboardSummary } from './dashboards.types';

@Injectable()
export class DashboardsService {
  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: AppDatabase,
    @Inject('ConnectionsService') private readonly connectionsService: ConnectionsService,
    @Inject(TENANT_DATABASE_PORT) private readonly tenantDatabasePort: TenantDatabasePort,
  ) {}

  async createDashboard(dto: CreateDashboardDto) {
    const now = new Date();
    const rows = await this.db
      .insert(tables.dashboards)
      .values({ id: crypto.randomUUID(), connectionId: dto.connectionId, name: dto.name, updatedAt: now })
      .returning();
    return rows[0];
  }

  async listDashboards(connectionId: string): Promise<DashboardSummary[]> {
    const dashboardRows = await this.db
      .select()
      .from(tables.dashboards)
      .where(eq(tables.dashboards.connectionId, connectionId))
      .orderBy(desc(tables.dashboards.createdAt));

    const summaries = await Promise.all(
      dashboardRows.map(async (dashboard) => {
        const countRows = await this.db
          .select({ count: count() })
          .from(tables.widgets)
          .where(eq(tables.widgets.dashboardId, dashboard.id));
        return {
          id: dashboard.id,
          name: dashboard.name,
          widgetCount: Number(countRows[0].count),
          createdAt: dashboard.createdAt,
        };
      }),
    );

    return summaries;
  }

  async getDashboard(id: string) {
    const dashboardRows = await this.db
      .select()
      .from(tables.dashboards)
      .where(eq(tables.dashboards.id, id));

    if (dashboardRows.length === 0) {
      throw new NotFoundException(`Dashboard ${id} not found`);
    }

    const widgetRows = await this.db
      .select()
      .from(tables.widgets)
      .where(eq(tables.widgets.dashboardId, id))
      .orderBy(asc(tables.widgets.position));

    return {
      ...dashboardRows[0],
      widgets: widgetRows.map(deserializeWidget),
    };
  }

  async addWidget(dashboardId: string, dto: CreateWidgetDto) {
    const countRows = await this.db
      .select({ count: count() })
      .from(tables.widgets)
      .where(eq(tables.widgets.dashboardId, dashboardId));

    const position = Number(countRows[0].count);
    const now = new Date();

    const rows = await this.db
      .insert(tables.widgets)
      .values({
        id: crypto.randomUUID(),
        dashboardId,
        title: dto.title,
        sql: dto.sql,
        chartType: dto.chartType,
        columns: JSON.stringify(dto.columns),
        legendLabels: null,
        position,
        updatedAt: now,
      })
      .returning();

    return deserializeWidget(rows[0]);
  }

  async updateWidget(dashboardId: string, widgetId: string, dto: UpdateWidgetDto) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.legendLabels !== undefined) {
      updateData.legendLabels = JSON.stringify(dto.legendLabels);
    }

    const rows = await this.db
      .update(tables.widgets)
      .set(updateData)
      .where(and(eq(tables.widgets.id, widgetId), eq(tables.widgets.dashboardId, dashboardId)))
      .returning();

    if (rows.length === 0) {
      throw new NotFoundException(`Widget ${widgetId} not found`);
    }

    return deserializeWidget(rows[0]);
  }

  async removeWidget(dashboardId: string, widgetId: string) {
    await this.db
      .delete(tables.widgets)
      .where(and(eq(tables.widgets.id, widgetId), eq(tables.widgets.dashboardId, dashboardId)));
  }

  async deleteDashboard(id: string) {
    await this.db
      .delete(tables.dashboards)
      .where(eq(tables.dashboards.id, id));
  }

  async executeWidgetSql(dashboardId: string, widgetId: string) {
    const widgetRows = await this.db
      .select()
      .from(tables.widgets)
      .where(and(eq(tables.widgets.id, widgetId), eq(tables.widgets.dashboardId, dashboardId)));

    if (widgetRows.length === 0) {
      throw new NotFoundException(`Widget ${widgetId} not found`);
    }

    const widget = deserializeWidget(widgetRows[0]);

    const dashboardRows = await this.db
      .select({ connectionId: tables.dashboards.connectionId })
      .from(tables.dashboards)
      .where(eq(tables.dashboards.id, dashboardId));

    const connectionId = dashboardRows[0].connectionId;
    const config = await this.connectionsService.getTenantConnectionConfig(connectionId);

    await this.tenantDatabasePort.connect(config);

    try {
      const result = await this.tenantDatabasePort.query(widget.sql);
      return { columns: widget.columns, rows: result.rows };
    } finally {
      await this.tenantDatabasePort.disconnect();
    }
  }
}

function deserializeWidget(row: typeof tables.widgets.$inferSelect) {
  return {
    ...row,
    columns: JSON.parse(row.columns),
    legendLabels: row.legendLabels ? JSON.parse(row.legendLabels) : null,
  };
}
