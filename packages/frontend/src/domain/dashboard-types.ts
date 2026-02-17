export type Dashboard = {
  id: string;
  name: string;
  widgetCount: number;
  createdAt: string;
};

export type CreateDashboardRequest = {
  connectionId: string;
  name: string;
};

export type CreateWidgetRequest = {
  title: string;
  sql: string;
  chartType: string;
  columns: { name: string; type: string; role: 'dimension' | 'measure' }[];
};

export type Widget = {
  id: string;
  dashboardId: string;
  title: string;
  sql: string;
  chartType: string;
  columns: { name: string; type: string; role: 'dimension' | 'measure' }[];
  legendLabels?: Record<string, string>;
  position: number;
  createdAt: string;
};

export type UpdateWidgetRequest = {
  title?: string;
  legendLabels?: Record<string, string>;
};

export type DashboardDetail = {
  id: string;
  name: string;
  widgets: Widget[];
};

export type WidgetExecutionResult = {
  columns: { name: string; type: string; role: 'dimension' | 'measure' }[];
  rows: Record<string, unknown>[];
};
