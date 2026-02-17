import type { Dashboard, CreateDashboardRequest, CreateWidgetRequest, UpdateWidgetRequest, Widget, DashboardDetail, WidgetExecutionResult } from '../domain/dashboard-types';

export interface DashboardPort {
  listDashboards(connectionId: string): Promise<Dashboard[]>;
  createDashboard(request: CreateDashboardRequest): Promise<Dashboard>;
  addWidget(dashboardId: string, request: CreateWidgetRequest): Promise<Widget>;
  getDashboard(id: string): Promise<DashboardDetail>;
  executeWidget(dashboardId: string, widgetId: string): Promise<WidgetExecutionResult>;
  updateWidget(dashboardId: string, widgetId: string, dto: UpdateWidgetRequest): Promise<Widget>;
  removeWidget(dashboardId: string, widgetId: string): Promise<void>;
  deleteDashboard(id: string): Promise<void>;
}
