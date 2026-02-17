import type { DashboardPort } from '../ports/dashboard-port';
import type { Dashboard, CreateDashboardRequest, CreateWidgetRequest, UpdateWidgetRequest, Widget, DashboardDetail, WidgetExecutionResult } from '../domain/dashboard-types';

export class FetchDashboardAdapter implements DashboardPort {
  async listDashboards(connectionId: string): Promise<Dashboard[]> {
    const response = await fetch(`/api/dashboards?connectionId=${connectionId}`);
    if (!response.ok) {
      throw new Error(`Failed to list dashboards: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  async createDashboard(request: CreateDashboardRequest): Promise<Dashboard> {
    const response = await fetch('/api/dashboards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new Error(`Failed to create dashboard: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  async addWidget(dashboardId: string, request: CreateWidgetRequest): Promise<Widget> {
    const response = await fetch(`/api/dashboards/${dashboardId}/widgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new Error(`Failed to add widget: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  async getDashboard(id: string): Promise<DashboardDetail> {
    const response = await fetch(`/api/dashboards/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to get dashboard: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  async executeWidget(dashboardId: string, widgetId: string): Promise<WidgetExecutionResult> {
    const response = await fetch(`/api/dashboards/${dashboardId}/widgets/${widgetId}/execute`, { method: 'POST' });
    if (!response.ok) {
      throw new Error(`Failed to execute widget: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  async updateWidget(dashboardId: string, widgetId: string, dto: UpdateWidgetRequest): Promise<Widget> {
    const response = await fetch(`/api/dashboards/${dashboardId}/widgets/${widgetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (!response.ok) {
      throw new Error(`Failed to update widget: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  async removeWidget(dashboardId: string, widgetId: string): Promise<void> {
    const response = await fetch(`/api/dashboards/${dashboardId}/widgets/${widgetId}`, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error(`Failed to remove widget: ${response.status} ${response.statusText}`);
    }
  }

  async deleteDashboard(id: string): Promise<void> {
    const response = await fetch(`/api/dashboards/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error(`Failed to delete dashboard: ${response.status} ${response.statusText}`);
    }
  }
}
