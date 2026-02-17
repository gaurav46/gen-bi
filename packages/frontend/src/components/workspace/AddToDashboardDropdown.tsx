import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { DashboardPort } from '../../ports/dashboard-port';
import type { Dashboard, CreateWidgetRequest } from '../../domain/dashboard-types';

type AddToDashboardDropdownProps = {
  port: DashboardPort;
  connectionId: string;
  widgetData: CreateWidgetRequest;
};

type Status = 'idle' | 'loading' | 'added' | 'failed';

export function AddToDashboardDropdown({ port, connectionId, widgetData }: AddToDashboardDropdownProps) {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('');

  async function loadDashboards() {
    try {
      const result = await port.listDashboards(connectionId);
      setDashboards(result);
    } catch {
      setStatus('failed');
    }
  }

  async function handleSelectDashboard(dashboardId: string) {
    try {
      setStatus('loading');
      await port.addWidget(dashboardId, widgetData);
      setStatus('added');
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('failed');
    }
  }

  async function handleCreateDashboard() {
    try {
      setStatus('loading');
      const dashboard = await port.createDashboard({ connectionId, name: newDashboardName });
      await port.addWidget(dashboard.id, widgetData);
      setShowCreateDialog(false);
      setNewDashboardName('');
      setStatus('added');
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('failed');
    }
  }

  if (status === 'added') {
    return (
      <span className="text-sm text-green-600">Added!</span>
    );
  }

  if (status === 'failed') {
    return (
      <span className="text-sm text-destructive">Failed to save widget</span>
    );
  }

  return (
    <>
      <DropdownMenu onOpenChange={(open) => { if (open) loadDashboards(); }}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={status === 'loading'}>
            Add to Dashboard
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {dashboards.map((d) => (
            <DropdownMenuItem key={d.id} onSelect={() => handleSelectDashboard(d.id)}>
              {d.name}
            </DropdownMenuItem>
          ))}
          {dashboards.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem onSelect={() => setShowCreateDialog(true)}>
            Create Dashboard
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Dashboard</DialogTitle>
            <DialogDescription>Give your dashboard a name</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Dashboard name"
            value={newDashboardName}
            onChange={(e) => setNewDashboardName(e.target.value)}
          />
          <DialogFooter>
            <Button
              onClick={handleCreateDashboard}
              disabled={!newDashboardName.trim()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
