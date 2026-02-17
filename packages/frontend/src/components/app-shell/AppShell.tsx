import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { SchemaExplorerPage } from '../schema-explorer/SchemaExplorerPage';
import { SettingsForm } from '../settings-form/SettingsForm';
import { ConnectionForm } from '../settings-form/ConnectionForm';
import { WorkspacePage } from '../workspace/WorkspacePage';
import { DashboardsLandingPage } from '../dashboards/DashboardsLandingPage';
import { DashboardDetailPage } from '../dashboards/DashboardDetailPage';
import type { SchemaDataPort } from '../../ports/schema-data-port';
import type { QueryPort } from '../../ports/query-port';
import type { DashboardPort } from '../../ports/dashboard-port';

type AppShellProps = {
  schemaPort: SchemaDataPort;
  queryPort: QueryPort;
  dashboardPort: DashboardPort;
};

export function AppShell({ schemaPort, queryPort, dashboardPort }: AppShellProps) {
  const [connectionId, setConnectionId] = useState<string | null>(
    () => localStorage.getItem('connectionId'),
  );

  if (!connectionId) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-6">
          <h1 className="text-2xl font-bold text-center">Gen BI</h1>
          <ConnectionForm onConnected={(id) => setConnectionId(id)} />
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 items-center border-b px-3">
          <SidebarTrigger />
        </header>
        <div className="flex-1">
          <Routes>
            <Route index element={<SchemaExplorerPage port={schemaPort} />} />
            <Route path="workspace" element={<WorkspacePage port={queryPort} dashboardPort={dashboardPort} />} />
            <Route path="dashboards" element={<DashboardsLandingPage dashboardPort={dashboardPort} connectionId={connectionId} />} />
            <Route path="dashboards/:id" element={<DashboardDetailPage dashboardPort={dashboardPort} />} />
            <Route path="settings" element={<SettingsForm />} />
          </Routes>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
