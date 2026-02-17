import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil, X } from 'lucide-react';
import { ChartRenderer } from '../workspace/ChartRenderer';
import type { DashboardPort } from '../../ports/dashboard-port';
import type { Widget, WidgetExecutionResult, UpdateWidgetRequest } from '../../domain/dashboard-types';
import { EditWidgetDialog } from './EditWidgetDialog';

type DashboardDetailPageProps = {
  dashboardPort: DashboardPort;
};

type WidgetState = {
  widget: Widget;
  result: WidgetExecutionResult | null;
  error: string | null;
};

export function DashboardDetailPage({ dashboardPort }: DashboardDetailPageProps) {
  const { id: dashboardId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dashboardName, setDashboardName] = useState('');
  const [widgetStates, setWidgetStates] = useState<WidgetState[]>([]);
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);

  useEffect(() => {
    if (!dashboardId) return;
    dashboardPort.getDashboard(dashboardId).then(async (dashboard) => {
      setDashboardName(dashboard.name);
      const states: WidgetState[] = dashboard.widgets.map((w) => ({
        widget: w,
        result: null,
        error: null,
      }));
      setWidgetStates(states);

      for (let i = 0; i < dashboard.widgets.length; i++) {
        try {
          const result = await dashboardPort.executeWidget(dashboardId, dashboard.widgets[i].id);
          setWidgetStates((prev) =>
            prev.map((s, idx) => (idx === i ? { ...s, result } : s)),
          );
        } catch (err: any) {
          setWidgetStates((prev) =>
            prev.map((s, idx) => (idx === i ? { ...s, error: err.message || 'Execution failed' } : s)),
          );
        }
      }
    });
  }, [dashboardPort, dashboardId]);

  async function handleRemove(widgetId: string) {
    if (!dashboardId) return;
    await dashboardPort.removeWidget(dashboardId, widgetId);
    setWidgetStates((prev) => prev.filter((s) => s.widget.id !== widgetId));
  }

  async function handleUpdate(dto: UpdateWidgetRequest) {
    if (!dashboardId || !editingWidget) return;
    const updated = await dashboardPort.updateWidget(dashboardId, editingWidget.id, dto);
    setWidgetStates((prev) =>
      prev.map((s) => (s.widget.id === updated.id ? { ...s, widget: updated } : s)),
    );
    setEditingWidget(null);
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => navigate('/dashboards')}>
          <ArrowLeft className="size-4" />
        </Button>
        <h2 className="text-xl font-semibold">{dashboardName}</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {widgetStates.map((ws) => (
          <Card key={ws.widget.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-base">{ws.widget.title}</CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Edit"
                  onClick={() => setEditingWidget(ws.widget)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove"
                  onClick={() => handleRemove(ws.widget.id)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {ws.error && <p className="text-sm text-destructive">Widget execution failed</p>}
              {ws.result && (
                <ChartRenderer
                  chartType={ws.widget.chartType}
                  columns={ws.result.columns}
                  rows={ws.result.rows}
                  legendLabels={ws.widget.legendLabels}
                />
              )}
              {!ws.error && !ws.result && <p className="text-sm text-muted-foreground">Loading...</p>}
            </CardContent>
          </Card>
        ))}
      </div>
      {editingWidget && (
        <EditWidgetDialog
          widget={editingWidget}
          open={!!editingWidget}
          onOpenChange={(open) => { if (!open) setEditingWidget(null); }}
          onSave={handleUpdate}
        />
      )}
    </div>
  );
}
