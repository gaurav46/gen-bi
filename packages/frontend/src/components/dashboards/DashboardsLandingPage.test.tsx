import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DashboardsLandingPage } from './DashboardsLandingPage';
import type { DashboardPort } from '../../ports/dashboard-port';

function createMockPort(overrides: Partial<DashboardPort> = {}): DashboardPort {
  return {
    listDashboards: vi.fn().mockResolvedValue([]),
    createDashboard: vi.fn(),
    addWidget: vi.fn(),
    getDashboard: vi.fn(),
    executeWidget: vi.fn(),
    updateWidget: vi.fn(),
    removeWidget: vi.fn(),
    deleteDashboard: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function renderWithRouter(port: DashboardPort, connectionId = 'conn-1') {
  return render(
    <MemoryRouter initialEntries={['/dashboards']}>
      <Routes>
        <Route path="/dashboards" element={<DashboardsLandingPage dashboardPort={port} connectionId={connectionId} />} />
        <Route path="/dashboards/:id" element={<div>Detail Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DashboardsLandingPage', () => {
  it('renders dashboard cards', async () => {
    const port = createMockPort({
      listDashboards: vi.fn().mockResolvedValue([
        { id: 'd1', name: 'Sales KPIs', widgetCount: 2, createdAt: '2025-01-01' },
        { id: 'd2', name: 'Marketing', widgetCount: 0, createdAt: '2025-01-02' },
      ]),
    });

    renderWithRouter(port);

    await waitFor(() => {
      expect(screen.getByText('Sales KPIs')).toBeInTheDocument();
    });
    expect(screen.getByText('Marketing')).toBeInTheDocument();
  });

  it('clicking a card navigates to dashboard detail', async () => {
    const port = createMockPort({
      listDashboards: vi.fn().mockResolvedValue([
        { id: 'd1', name: 'Sales KPIs', widgetCount: 2, createdAt: '2025-01-01' },
      ]),
    });

    renderWithRouter(port);

    await waitFor(() => {
      expect(screen.getByText('Sales KPIs')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Sales KPIs'));

    await waitFor(() => {
      expect(screen.getByText('Detail Page')).toBeInTheDocument();
    });
  });

  it('shows empty state when no dashboards', async () => {
    const port = createMockPort();

    renderWithRouter(port);

    await waitFor(() => {
      expect(screen.getByText(/no dashboards/i)).toBeInTheDocument();
    });
  });

  it('delete button removes dashboard after confirm', async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const port = createMockPort({
      listDashboards: vi.fn().mockResolvedValue([
        { id: 'd1', name: 'Sales KPIs', widgetCount: 2, createdAt: '2025-01-01' },
      ]),
      deleteDashboard: deleteFn,
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderWithRouter(port);

    await waitFor(() => {
      expect(screen.getByText('Sales KPIs')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /delete/i }));

    await waitFor(() => {
      expect(deleteFn).toHaveBeenCalledWith('d1');
    });
    expect(screen.queryByText('Sales KPIs')).not.toBeInTheDocument();
  });

  it('delete cancelled does nothing', async () => {
    const deleteFn = vi.fn();
    const port = createMockPort({
      listDashboards: vi.fn().mockResolvedValue([
        { id: 'd1', name: 'Sales KPIs', widgetCount: 2, createdAt: '2025-01-01' },
      ]),
      deleteDashboard: deleteFn,
    });
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderWithRouter(port);

    await waitFor(() => {
      expect(screen.getByText('Sales KPIs')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /delete/i }));

    expect(deleteFn).not.toHaveBeenCalled();
    expect(screen.getByText('Sales KPIs')).toBeInTheDocument();
  });
});
