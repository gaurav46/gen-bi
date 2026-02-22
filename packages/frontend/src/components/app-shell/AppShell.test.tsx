import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from './AppShell';
import type { SchemaDataPort } from '../../ports/schema-data-port';
import type { QueryPort } from '../../ports/query-port';
import type { DashboardPort } from '../../ports/dashboard-port';

function createMockSchemaPort(): SchemaDataPort {
  return { fetchTables: vi.fn().mockResolvedValue([]), fetchTableRows: vi.fn() };
}

function createMockQueryPort(): QueryPort {
  return { submitQuery: vi.fn().mockResolvedValue({}) };
}

function createMockDashboardPort(): DashboardPort {
  return {
    listDashboards: vi.fn().mockResolvedValue([]),
    createDashboard: vi.fn(),
    addWidget: vi.fn(),
    getDashboard: vi.fn(),
    executeWidget: vi.fn(),
    updateWidget: vi.fn(),
    removeWidget: vi.fn(),
    deleteDashboard: vi.fn(),
  };
}

function renderShell(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppShell
        schemaPort={createMockSchemaPort()}
        queryPort={createMockQueryPort()}
        dashboardPort={createMockDashboardPort()}
      />
    </MemoryRouter>,
  );
}

describe('AppShell', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }));
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('shows landing page with connection form when no connectionId', () => {
    renderShell();

    expect(screen.getByText('Gen BI')).toBeInTheDocument();
    expect(screen.getByLabelText(/host/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument();
    expect(screen.queryByText('Schema Explorer')).not.toBeInTheDocument();
  });

  it('shows sidebar and main content when connectionId exists', () => {
    localStorage.setItem('connectionId', 'conn-1');
    renderShell();

    expect(screen.getByText('Schema Explorer')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('transitions to shell after connecting from landing page', async () => {
    const fetchSpy = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'new-conn' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const user = userEvent.setup();
    renderShell();

    await user.type(screen.getByLabelText(/host/i), 'localhost');
    await user.type(screen.getByLabelText(/database/i), 'mydb');
    await user.type(screen.getByLabelText(/username/i), 'admin');
    await user.type(screen.getByLabelText(/password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /connect/i }));

    await waitFor(() => {
      expect(screen.getByText('Schema Explorer')).toBeInTheDocument();
    });
  });

  it('switches between Schema Explorer and Settings pages', async () => {
    localStorage.setItem('connectionId', 'conn-1');
    renderShell();

    await waitFor(() => {
      expect(screen.getByText('No tables discovered. Run analysis in Settings first.')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Settings'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    });
  });
});
