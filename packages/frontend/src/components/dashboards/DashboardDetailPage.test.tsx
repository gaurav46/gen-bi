import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DashboardDetailPage } from './DashboardDetailPage';
import type { DashboardPort } from '../../ports/dashboard-port';

function createMockPort(overrides: Partial<DashboardPort> = {}): DashboardPort {
  return {
    listDashboards: vi.fn(),
    createDashboard: vi.fn(),
    addWidget: vi.fn(),
    getDashboard: vi.fn().mockResolvedValue({ id: 'd1', name: 'Sales', widgets: [] }),
    executeWidget: vi.fn().mockResolvedValue({ columns: [], rows: [] }),
    updateWidget: vi.fn().mockResolvedValue({}),
    removeWidget: vi.fn().mockResolvedValue(undefined),
    deleteDashboard: vi.fn(),
    ...overrides,
  };
}

function renderWithRoute(port: DashboardPort, dashboardId = 'd1') {
  return render(
    <MemoryRouter initialEntries={[`/dashboards/${dashboardId}`]}>
      <Routes>
        <Route path="/dashboards/:id" element={<DashboardDetailPage dashboardPort={port} />} />
        <Route path="/dashboards" element={<div>Landing Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DashboardDetailPage', () => {
  it('renders widget titles and charts', async () => {
    const port = createMockPort({
      getDashboard: vi.fn().mockResolvedValue({
        id: 'd1',
        name: 'Sales KPIs',
        widgets: [
          { id: 'w1', dashboardId: 'd1', title: 'Revenue', sql: 'SELECT 1', chartType: 'bar', columns: [{ name: 'name', type: 'varchar', role: 'dimension' }, { name: 'total', type: 'numeric', role: 'measure' }], position: 0, createdAt: '2025-01-01' },
          { id: 'w2', dashboardId: 'd1', title: 'Users', sql: 'SELECT 1', chartType: 'bar', columns: [{ name: 'name', type: 'varchar', role: 'dimension' }, { name: 'count', type: 'numeric', role: 'measure' }], position: 1, createdAt: '2025-01-01' },
        ],
      }),
      executeWidget: vi.fn().mockResolvedValue({
        columns: [{ name: 'name', type: 'varchar', role: 'dimension' }, { name: 'total', type: 'numeric', role: 'measure' }],
        rows: [{ name: 'Alice', total: 100 }],
      }),
    });

    renderWithRoute(port);

    await waitFor(() => {
      expect(screen.getByText('Revenue')).toBeInTheDocument();
    });
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Sales KPIs')).toBeInTheDocument();
  });

  it('shows error state for failed widget execution', async () => {
    const executeWidget = vi.fn()
      .mockResolvedValueOnce({
        columns: [{ name: 'name', type: 'varchar', role: 'dimension' }, { name: 'total', type: 'numeric', role: 'measure' }],
        rows: [{ name: 'Alice', total: 100 }],
      })
      .mockRejectedValueOnce(new Error('Query failed'));

    const port = createMockPort({
      getDashboard: vi.fn().mockResolvedValue({
        id: 'd1',
        name: 'Sales KPIs',
        widgets: [
          { id: 'w1', dashboardId: 'd1', title: 'Revenue', sql: 'SELECT 1', chartType: 'bar', columns: [{ name: 'name', type: 'varchar', role: 'dimension' }, { name: 'total', type: 'numeric', role: 'measure' }], position: 0, createdAt: '2025-01-01' },
          { id: 'w2', dashboardId: 'd1', title: 'Failing Widget', sql: 'SELECT bad', chartType: 'bar', columns: [], position: 1, createdAt: '2025-01-01' },
        ],
      }),
      executeWidget,
    });

    renderWithRoute(port);

    await waitFor(() => {
      expect(screen.getByText('Revenue')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeInTheDocument();
    });
  });

  it('remove widget removes it from view', async () => {
    const port = createMockPort({
      getDashboard: vi.fn().mockResolvedValue({
        id: 'd1',
        name: 'Sales KPIs',
        widgets: [
          { id: 'w1', dashboardId: 'd1', title: 'Revenue', sql: 'SELECT 1', chartType: 'bar', columns: [{ name: 'name', type: 'varchar', role: 'dimension' }, { name: 'total', type: 'numeric', role: 'measure' }], position: 0, createdAt: '2025-01-01' },
        ],
      }),
      executeWidget: vi.fn().mockResolvedValue({
        columns: [{ name: 'name', type: 'varchar', role: 'dimension' }, { name: 'total', type: 'numeric', role: 'measure' }],
        rows: [{ name: 'Alice', total: 100 }],
      }),
    });

    renderWithRoute(port);

    await waitFor(() => {
      expect(screen.getByText('Revenue')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /remove/i }));

    await waitFor(() => {
      expect(screen.queryByText('Revenue')).not.toBeInTheDocument();
    });
    expect(port.removeWidget).toHaveBeenCalledWith('d1', 'w1');
  });

  it('each widget shows an edit button that opens a dialog', async () => {
    const port = createMockPort({
      getDashboard: vi.fn().mockResolvedValue({
        id: 'd1',
        name: 'Sales KPIs',
        widgets: [
          { id: 'w1', dashboardId: 'd1', title: 'Revenue', sql: 'SELECT 1', chartType: 'bar', columns: [{ name: 'month', type: 'varchar', role: 'dimension' }, { name: 'total', type: 'numeric', role: 'measure' }], position: 0, createdAt: '2025-01-01' },
        ],
      }),
      executeWidget: vi.fn().mockResolvedValue({
        columns: [{ name: 'month', type: 'varchar', role: 'dimension' }, { name: 'total', type: 'numeric', role: 'measure' }],
        rows: [{ month: 'Jan', total: 100 }],
      }),
    });

    renderWithRoute(port);

    await waitFor(() => {
      expect(screen.getByText('Revenue')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('Revenue')).toBeInTheDocument();
  });

  it('saving edit dialog calls updateWidget and updates title in-place', async () => {
    const updatedWidget = {
      id: 'w1', dashboardId: 'd1', title: 'Monthly Revenue', sql: 'SELECT 1', chartType: 'bar',
      columns: [{ name: 'month', type: 'varchar', role: 'dimension' }, { name: 'total', type: 'numeric', role: 'measure' }],
      legendLabels: { total: 'Total Rev' }, position: 0, createdAt: '2025-01-01',
    };
    const port = createMockPort({
      getDashboard: vi.fn().mockResolvedValue({
        id: 'd1',
        name: 'Sales KPIs',
        widgets: [
          { id: 'w1', dashboardId: 'd1', title: 'Revenue', sql: 'SELECT 1', chartType: 'bar', columns: [{ name: 'month', type: 'varchar', role: 'dimension' }, { name: 'total', type: 'numeric', role: 'measure' }], position: 0, createdAt: '2025-01-01' },
        ],
      }),
      executeWidget: vi.fn().mockResolvedValue({
        columns: [{ name: 'month', type: 'varchar', role: 'dimension' }, { name: 'total', type: 'numeric', role: 'measure' }],
        rows: [{ month: 'Jan', total: 100 }],
      }),
      updateWidget: vi.fn().mockResolvedValue(updatedWidget),
    });

    renderWithRoute(port);

    await waitFor(() => {
      expect(screen.getByText('Revenue')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const titleInput = screen.getByDisplayValue('Revenue');
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Monthly Revenue');

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText('Monthly Revenue')).toBeInTheDocument();
    });
    expect(port.updateWidget).toHaveBeenCalledWith('d1', 'w1', {
      title: 'Monthly Revenue',
      legendLabels: { total: 'total' },
    });
  });

  it('back button navigates to /dashboards', async () => {
    const port = createMockPort();

    renderWithRoute(port);

    await userEvent.click(screen.getByRole('button', { name: /back/i }));

    await waitFor(() => {
      expect(screen.getByText('Landing Page')).toBeInTheDocument();
    });
  });
});
