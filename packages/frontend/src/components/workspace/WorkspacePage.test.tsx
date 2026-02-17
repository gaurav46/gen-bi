import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkspacePage } from './WorkspacePage';
import type { QueryPort } from '../../ports/query-port';
import type { DashboardPort } from '../../ports/dashboard-port';
import type { QueryResponse } from '../../domain/query-types';

const cannedResponse: QueryResponse = {
  intent: 'top_customers',
  title: 'Top Customers by Revenue',
  sql: 'SELECT name, revenue FROM customers ORDER BY revenue DESC',
  visualization: { chartType: 'bar' },
  columns: [
    { name: 'name', type: 'varchar', role: 'dimension' },
    { name: 'revenue', type: 'numeric', role: 'measure' },
  ],
  rows: [
    { name: 'Alice', revenue: 12500 },
    { name: 'Bob', revenue: null },
  ],
  attempts: 1,
};

describe('WorkspacePage', () => {
  let port: QueryPort;
  let dashboardPort: DashboardPort;

  beforeEach(() => {
    localStorage.setItem('connectionId', 'conn-1');
    port = {
      submitQuery: vi.fn().mockResolvedValue(cannedResponse),
    };
    dashboardPort = {
      listDashboards: vi.fn().mockResolvedValue([]),
      createDashboard: vi.fn(),
      addWidget: vi.fn(),
    };
  });

  it('renders input bar and submit button', () => {
    render(<WorkspacePage port={port} dashboardPort={dashboardPort} />);

    expect(screen.getByPlaceholderText('Ask a question...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ask/i })).toBeInTheDocument();
  });

  it('displays title, table headers, row data, and SQL after submitting a question', async () => {
    port.submitQuery = vi.fn().mockResolvedValue({
      ...cannedResponse,
      visualization: { chartType: 'table' },
    });

    render(<WorkspacePage port={port} dashboardPort={dashboardPort} />);

    await userEvent.type(screen.getByPlaceholderText('Ask a question...'), 'Show top customers');
    await userEvent.click(screen.getByRole('button', { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByText('Top Customers by Revenue')).toBeInTheDocument();
    });

    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('revenue')).toBeInTheDocument();

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('12500')).toBeInTheDocument();

    const nullCell = screen.getByText('null');
    expect(nullCell).toBeInTheDocument();
    expect(nullCell.className).toContain('italic');

    await userEvent.click(screen.getByText(/view generated sql/i));
    expect(screen.getByText(/SELECT name, revenue/)).toBeInTheDocument();

    expect(port.submitQuery).toHaveBeenCalledWith({
      connectionId: 'conn-1',
      question: 'Show top customers',
    });
  });

  it('shows attempt count when attempts > 1', async () => {
    port.submitQuery = vi.fn().mockResolvedValue({
      ...cannedResponse,
      attempts: 2,
    });

    render(<WorkspacePage port={port} dashboardPort={dashboardPort} />);

    await userEvent.type(screen.getByPlaceholderText('Ask a question...'), 'test');
    await userEvent.click(screen.getByRole('button', { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByText(/after 2 attempts/i)).toBeInTheDocument();
    });
  });

  it('renders bar chart when chartType is bar', async () => {
    render(<WorkspacePage port={port} dashboardPort={dashboardPort} />);

    await userEvent.type(screen.getByPlaceholderText('Ask a question...'), 'Show top customers');
    await userEvent.click(screen.getByRole('button', { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByText('Top Customers by Revenue')).toBeInTheDocument();
    });

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText(/view generated sql/i)).toBeInTheDocument();
  });

  it('renders table when chartType is table', async () => {
    port.submitQuery = vi.fn().mockResolvedValue({
      ...cannedResponse,
      visualization: { chartType: 'table' },
    });

    render(<WorkspacePage port={port} dashboardPort={dashboardPort} />);

    await userEvent.type(screen.getByPlaceholderText('Ask a question...'), 'Show top customers');
    await userEvent.click(screen.getByRole('button', { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByText('Top Customers by Revenue')).toBeInTheDocument();
    });

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument();
  });

  it('renders line chart when chartType is line', async () => {
    port.submitQuery = vi.fn().mockResolvedValue({
      ...cannedResponse,
      visualization: { chartType: 'line' },
    });

    render(<WorkspacePage port={port} dashboardPort={dashboardPort} />);

    await userEvent.type(screen.getByPlaceholderText('Ask a question...'), 'Show trend');
    await userEvent.click(screen.getByRole('button', { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  it('renders area chart when chartType is area', async () => {
    port.submitQuery = vi.fn().mockResolvedValue({
      ...cannedResponse,
      visualization: { chartType: 'area' },
    });

    render(<WorkspacePage port={port} dashboardPort={dashboardPort} />);

    await userEvent.type(screen.getByPlaceholderText('Ask a question...'), 'Show volume');
    await userEvent.click(screen.getByRole('button', { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });
  });

  it('renders pie chart when chartType is pie', async () => {
    port.submitQuery = vi.fn().mockResolvedValue({
      ...cannedResponse,
      visualization: { chartType: 'pie' },
    });

    render(<WorkspacePage port={port} dashboardPort={dashboardPort} />);

    await userEvent.type(screen.getByPlaceholderText('Ask a question...'), 'Show distribution');
    await userEvent.click(screen.getByRole('button', { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    });
  });

  it('renders KPI card when chartType is kpi_card', async () => {
    port.submitQuery = vi.fn().mockResolvedValue({
      ...cannedResponse,
      visualization: { chartType: 'kpi_card' },
      columns: [
        { name: 'total_revenue', type: 'numeric', role: 'measure' },
      ],
      rows: [{ total_revenue: 125000 }],
      title: 'Total Revenue',
    });

    render(<WorkspacePage port={port} dashboardPort={dashboardPort} />);

    await userEvent.type(screen.getByPlaceholderText('Ask a question...'), 'What is total revenue?');
    await userEvent.click(screen.getByRole('button', { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByTestId('kpi-card')).toBeInTheDocument();
    });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument();
    expect(screen.getByText(/view generated sql/i)).toBeInTheDocument();
  });

  it('chart type selector switches visualization without re-querying', async () => {
    render(<WorkspacePage port={port} dashboardPort={dashboardPort} />);

    await userEvent.type(screen.getByPlaceholderText('Ask a question...'), 'Show top customers');
    await userEvent.click(screen.getByRole('button', { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });

    expect(screen.getByTestId('chart-type-selector')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bar' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Line' }));

    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
    expect(port.submitQuery).toHaveBeenCalledTimes(1);
  });

  it('renders chart type selector after query response', async () => {
    render(<WorkspacePage port={port} dashboardPort={dashboardPort} />);

    await userEvent.type(screen.getByPlaceholderText('Ask a question...'), 'Show top customers');
    await userEvent.click(screen.getByRole('button', { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByTestId('chart-type-selector')).toBeInTheDocument();
    });
  });

  it('chart type selector defaults to AI-recommended type', async () => {
    port.submitQuery = vi.fn().mockResolvedValue({
      ...cannedResponse,
      visualization: { chartType: 'pie' },
    });

    render(<WorkspacePage port={port} dashboardPort={dashboardPort} />);

    await userEvent.type(screen.getByPlaceholderText('Ask a question...'), 'Show distribution');
    await userEvent.click(screen.getByRole('button', { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pie' })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('selecting table chart type renders ResultsTable', async () => {
    render(<WorkspacePage port={port} dashboardPort={dashboardPort} />);

    await userEvent.type(screen.getByPlaceholderText('Ask a question...'), 'Show top customers');
    await userEvent.click(screen.getByRole('button', { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Table' }));

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('switching from table back to chart type renders chart', async () => {
    port.submitQuery = vi.fn().mockResolvedValue({
      ...cannedResponse,
      visualization: { chartType: 'table' },
    });

    render(<WorkspacePage port={port} dashboardPort={dashboardPort} />);

    await userEvent.type(screen.getByPlaceholderText('Ask a question...'), 'Show top customers');
    await userEvent.click(screen.getByRole('button', { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Bar' }));

    await waitFor(() => {
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('override resets when new query is submitted', async () => {
    port.submitQuery = vi
      .fn()
      .mockResolvedValueOnce(cannedResponse)
      .mockResolvedValueOnce({
        ...cannedResponse,
        visualization: { chartType: 'pie' },
      });

    render(<WorkspacePage port={port} dashboardPort={dashboardPort} />);

    await userEvent.type(screen.getByPlaceholderText('Ask a question...'), 'Show top customers');
    await userEvent.click(screen.getByRole('button', { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Line' }));

    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    await userEvent.clear(screen.getByPlaceholderText('Ask a question...'));
    await userEvent.type(screen.getByPlaceholderText('Ask a question...'), 'Show distribution');
    await userEvent.click(screen.getByRole('button', { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pie' })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('chart type selector is not visible before query', () => {
    render(<WorkspacePage port={port} dashboardPort={dashboardPort} />);

    expect(screen.queryByTestId('chart-type-selector')).not.toBeInTheDocument();
  });

  it('shows error message when query fails', async () => {
    port.submitQuery = vi.fn().mockRejectedValue(new Error('Something went wrong'));

    render(<WorkspacePage port={port} dashboardPort={dashboardPort} />);

    await userEvent.type(screen.getByPlaceholderText('Ask a question...'), 'test');
    await userEvent.click(screen.getByRole('button', { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
    });
  });

  it('shows Add to Dashboard dropdown after query response', async () => {
    render(<WorkspacePage port={port} dashboardPort={dashboardPort} />);

    expect(screen.queryByRole('button', { name: /add to dashboard/i })).not.toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('Ask a question...'), 'Show top customers');
    await userEvent.click(screen.getByRole('button', { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add to dashboard/i })).toBeInTheDocument();
    });
  });
});
