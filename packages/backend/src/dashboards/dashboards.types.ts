export type CreateDashboardDto = {
  connectionId: string;
  name: string;
};

export type CreateWidgetDto = {
  title: string;
  sql: string;
  chartType: string;
  columns: { name: string; type: string; role: string }[];
};

export type UpdateWidgetDto = {
  title?: string;
  legendLabels?: Record<string, string>;
};

export type DashboardSummary = {
  id: string;
  name: string;
  widgetCount: number;
  createdAt: Date;
};
