import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkspacePage } from './WorkspacePage';
import type { QueryPort } from '../../ports/query-port';
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

  beforeEach(() => {
    localStorage.setItem('connectionId', 'conn-1');
    port = {
      submitQuery: vi.fn().mockResolvedValue(cannedResponse),
    };
  });

  it('renders input bar and submit button', () => {
    render(<WorkspacePage port={port} />);

    expect(screen.getByPlaceholderText('Ask a question...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ask/i })).toBeInTheDocument();
  });

  it('displays title, table headers, row data, and SQL after submitting a question', async () => {
    render(<WorkspacePage port={port} />);

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

    render(<WorkspacePage port={port} />);

    await userEvent.type(screen.getByPlaceholderText('Ask a question...'), 'test');
    await userEvent.click(screen.getByRole('button', { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByText(/after 2 attempts/i)).toBeInTheDocument();
    });
  });

  it('shows error message when query fails', async () => {
    port.submitQuery = vi.fn().mockRejectedValue(new Error('Something went wrong'));

    render(<WorkspacePage port={port} />);

    await userEvent.type(screen.getByPlaceholderText('Ask a question...'), 'test');
    await userEvent.click(screen.getByRole('button', { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
    });
  });
});
