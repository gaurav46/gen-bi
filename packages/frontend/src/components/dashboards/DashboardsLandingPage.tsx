import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import type { DashboardPort } from '../../ports/dashboard-port';
import type { Dashboard } from '../../domain/dashboard-types';

type DashboardsLandingPageProps = {
  dashboardPort: DashboardPort;
  connectionId: string;
};

export function DashboardsLandingPage({ dashboardPort, connectionId }: DashboardsLandingPageProps) {
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    dashboardPort.listDashboards(connectionId).then((result) => {
      setDashboards(result);
      setLoaded(true);
    });
  }, [dashboardPort, connectionId]);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!window.confirm('Delete this dashboard? All widgets will be removed.')) return;
    await dashboardPort.deleteDashboard(id);
    setDashboards((prev) => prev.filter((d) => d.id !== id));
  }

  if (loaded && dashboards.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">No dashboards yet. Add widgets from the Workspace to create one.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Dashboards</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dashboards.map((dashboard) => (
          <Card
            key={dashboard.id}
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => navigate(`/dashboards/${dashboard.id}`)}
          >
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{dashboard.name}</CardTitle>
                <CardDescription>{dashboard.widgetCount} widget{dashboard.widgetCount !== 1 ? 's' : ''}</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete"
                onClick={(e) => handleDelete(e, dashboard.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
