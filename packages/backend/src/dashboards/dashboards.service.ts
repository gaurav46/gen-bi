import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ConnectionsService, PRISMA_CLIENT } from '../connections/connections.service';
import type { TenantDatabasePort } from '../schema-discovery/tenant-database.port';
import { TENANT_DATABASE_PORT } from '../schema-discovery/schema-discovery.service';
import type { CreateDashboardDto, CreateWidgetDto, UpdateWidgetDto, DashboardSummary } from './dashboards.types';

@Injectable()
export class DashboardsService {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: any,
    private readonly connectionsService: ConnectionsService,
    @Inject(TENANT_DATABASE_PORT) private readonly tenantDatabasePort: TenantDatabasePort,
  ) {}

  async createDashboard(dto: CreateDashboardDto) {
    return this.prisma.dashboard.create({
      data: { connectionId: dto.connectionId, name: dto.name },
    });
  }

  async listDashboards(connectionId: string): Promise<DashboardSummary[]> {
    const dashboards = await this.prisma.dashboard.findMany({
      where: { connectionId },
      include: { _count: { select: { widgets: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return dashboards.map((d: any) => ({
      id: d.id,
      name: d.name,
      widgetCount: d._count.widgets,
      createdAt: d.createdAt,
    }));
  }

  async addWidget(dashboardId: string, dto: CreateWidgetDto) {
    const position = await this.prisma.widget.count({
      where: { dashboardId },
    });

    return this.prisma.widget.create({
      data: {
        dashboardId,
        title: dto.title,
        sql: dto.sql,
        chartType: dto.chartType,
        columns: dto.columns,
        position,
      },
    });
  }

  async getDashboard(id: string) {
    try {
      return await this.prisma.dashboard.findUniqueOrThrow({
        where: { id },
        include: { widgets: { orderBy: { position: 'asc' } } },
      });
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        throw new NotFoundException(`Dashboard ${id} not found`);
      }
      throw error;
    }
  }

  async executeWidgetSql(dashboardId: string, widgetId: string) {
    const widget = await this.prisma.widget.findUniqueOrThrow({
      where: { id: widgetId, dashboardId },
      include: { dashboard: { select: { connectionId: true } } },
    });

    const config = await this.connectionsService.getTenantConnectionConfig(widget.dashboard.connectionId);
    await this.tenantDatabasePort.connect(config);

    try {
      const result = await this.tenantDatabasePort.query(widget.sql);
      return { columns: widget.columns, rows: result.rows };
    } finally {
      await this.tenantDatabasePort.disconnect();
    }
  }

  async updateWidget(dashboardId: string, widgetId: string, dto: UpdateWidgetDto) {
    try {
      return await this.prisma.widget.update({
        where: { id: widgetId, dashboardId },
        data: { ...dto },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Widget ${widgetId} not found`);
      }
      throw error;
    }
  }

  async removeWidget(dashboardId: string, widgetId: string) {
    await this.prisma.widget.delete({
      where: { id: widgetId, dashboardId },
    });
  }

  async deleteDashboard(id: string) {
    await this.prisma.dashboard.delete({
      where: { id },
    });
  }
}
