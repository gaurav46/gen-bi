import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddToDashboardDropdown } from './AddToDashboardDropdown';
import type { DashboardPort } from '../../ports/dashboard-port';

const widgetData = {
  title: 'Top Customers',
  sql: 'SELECT name, revenue FROM customers',
  chartType: 'bar',
  columns: [
    { name: 'name', type: 'varchar', role: 'dimension' },
    { name: 'revenue', type: 'numeric', role: 'measure' },
  ],
};

describe('AddToDashboardDropdown', () => {
  let port: DashboardPort;

  beforeEach(() => {
    port = {
      listDashboards: vi.fn().mockResolvedValue([
        { id: 'd1', name: 'Sales KPIs', widgetCount: 2, createdAt: '2025-01-01' },
        { id: 'd2', name: 'Inventory', widgetCount: 0, createdAt: '2025-01-02' },
      ]),
      createDashboard: vi.fn().mockResolvedValue({
        id: 'd3', name: 'New Dashboard', widgetCount: 0, createdAt: '2025-01-03',
      }),
      addWidget: vi.fn().mockResolvedValue({
        id: 'w1', dashboardId: 'd1', ...widgetData, position: 2, createdAt: '2025-01-01',
      }),
    };
  });

  it('shows existing dashboards when opened', async () => {
    render(
      <AddToDashboardDropdown
        port={port}
        connectionId="conn-1"
        widgetData={widgetData}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /add to dashboard/i }));

    await waitFor(() => {
      expect(screen.getByText('Sales KPIs')).toBeInTheDocument();
    });
    expect(screen.getByText('Inventory')).toBeInTheDocument();
    expect(screen.getByText('Create Dashboard')).toBeInTheDocument();
  });

  it('adds widget to selected dashboard', async () => {
    render(
      <AddToDashboardDropdown
        port={port}
        connectionId="conn-1"
        widgetData={widgetData}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /add to dashboard/i }));

    await waitFor(() => {
      expect(screen.getByText('Sales KPIs')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Sales KPIs'));

    expect(port.addWidget).toHaveBeenCalledWith('d1', widgetData);

    await waitFor(() => {
      expect(screen.getByText(/added/i)).toBeInTheDocument();
    });
  });

  it('creates dashboard then adds widget when Create Dashboard selected', async () => {
    render(
      <AddToDashboardDropdown
        port={port}
        connectionId="conn-1"
        widgetData={widgetData}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /add to dashboard/i }));

    await waitFor(() => {
      expect(screen.getByText('Create Dashboard')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Create Dashboard'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Dashboard name')).toBeInTheDocument();
    });

    await userEvent.type(screen.getByPlaceholderText('Dashboard name'), 'New Dashboard');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(port.createDashboard).toHaveBeenCalledWith({
        connectionId: 'conn-1',
        name: 'New Dashboard',
      });
    });

    expect(port.addWidget).toHaveBeenCalledWith('d3', widgetData);

    await waitFor(() => {
      expect(screen.getByText(/added/i)).toBeInTheDocument();
    });
  });

  it('shows error when addWidget fails', async () => {
    (port.addWidget as any).mockRejectedValue(new Error('Server error'));

    render(
      <AddToDashboardDropdown
        port={port}
        connectionId="conn-1"
        widgetData={widgetData}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /add to dashboard/i }));

    await waitFor(() => {
      expect(screen.getByText('Sales KPIs')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Sales KPIs'));

    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeInTheDocument();
    });
  });

  it('shows error when listDashboards fails', async () => {
    (port.listDashboards as any).mockRejectedValue(new Error('Network error'));

    render(
      <AddToDashboardDropdown
        port={port}
        connectionId="conn-1"
        widgetData={widgetData}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /add to dashboard/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeInTheDocument();
    });
  });
});
