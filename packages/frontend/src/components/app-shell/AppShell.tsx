import { useState } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar, type PageId } from './AppSidebar';
import { SchemaExplorerPage } from '../schema-explorer/SchemaExplorerPage';
import { SettingsForm } from '../settings-form/SettingsForm';
import { ConnectionForm } from '../settings-form/ConnectionForm';
import { WorkspacePage } from '../workspace/WorkspacePage';
import type { SchemaDataPort } from '../../ports/schema-data-port';
import type { QueryPort } from '../../ports/query-port';

type AppShellProps = {
  schemaPort: SchemaDataPort;
  queryPort: QueryPort;
};

export function AppShell({ schemaPort, queryPort }: AppShellProps) {
  const [connectionId, setConnectionId] = useState<string | null>(
    () => localStorage.getItem('connectionId'),
  );
  const [activePage, setActivePage] = useState<PageId>('schema-explorer');

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
      <AppSidebar activePage={activePage} onNavigate={setActivePage} />
      <SidebarInset>
        <header className="flex h-12 items-center border-b px-3">
          <SidebarTrigger />
        </header>
        <div className="flex-1">
          {activePage === 'schema-explorer' && <SchemaExplorerPage port={schemaPort} />}
          {activePage === 'workspace' && <WorkspacePage port={queryPort} />}
          {activePage === 'settings' && <SettingsForm />}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
