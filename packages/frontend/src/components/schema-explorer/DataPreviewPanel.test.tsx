import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataPreviewPanel } from './DataPreviewPanel';

const defaultProps = {
  rows: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
  columns: ['id', 'name'],
  totalRows: 50,
  page: 1,
  pageSize: 25,
  isLoading: false,
  error: null as string | null,
  onNextPage: vi.fn(),
  onPreviousPage: vi.fn(),
  onRetry: vi.fn(),
};

describe('DataPreviewPanel', () => {
  it('renders column headers and row values', () => {
    render(<DataPreviewPanel {...defaultProps} />);

    expect(screen.getByText('id')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows loading skeletons while fetching', () => {
    render(<DataPreviewPanel {...defaultProps} isLoading={true} rows={[]} />);

    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows error message with retry button', async () => {
    const onRetry = vi.fn();
    render(<DataPreviewPanel {...defaultProps} error="Connection timeout" rows={[]} onRetry={onRetry} />);

    expect(screen.getByText('Connection timeout')).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: 'Retry' });
    expect(retryButton).toBeInTheDocument();

    await userEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalled();
  });

  it('shows no data message when rows are empty', () => {
    render(<DataPreviewPanel {...defaultProps} rows={[]} totalRows={0} />);

    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('renders null values distinctly from empty strings', () => {
    render(
      <DataPreviewPanel
        {...defaultProps}
        columns={['name']}
        rows={[{ name: null }, { name: '' }]}
        totalRows={2}
      />,
    );

    const nullCell = screen.getByText('null');
    expect(nullCell).toHaveClass('italic');

    const cells = document.querySelectorAll('td');
    const emptyCell = Array.from(cells).find(
      (cell) => cell.textContent === '' || (cell.textContent !== 'null' && cell.textContent?.trim() === ''),
    );
    expect(emptyCell).toBeDefined();
  });

  it('truncates long text values in cells', () => {
    const longText = 'x'.repeat(500);
    render(
      <DataPreviewPanel
        {...defaultProps}
        columns={['content']}
        rows={[{ content: longText }]}
        totalRows={1}
      />,
    );

    const cell = screen.getByText(longText);
    expect(cell.className).toMatch(/truncate/);
  });

  it('shows page indicator and total row count', () => {
    render(<DataPreviewPanel {...defaultProps} page={1} pageSize={25} totalRows={300} />);

    expect(screen.getByText('Page 1 of 12')).toBeInTheDocument();
    expect(screen.getByText('300 rows')).toBeInTheDocument();
  });

  it('Previous button is disabled on page 1', () => {
    render(<DataPreviewPanel {...defaultProps} page={1} />);

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  it('Next button is disabled on last page', () => {
    render(<DataPreviewPanel {...defaultProps} page={12} pageSize={25} totalRows={300} />);

    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('clicking Next and Previous calls navigation callbacks', async () => {
    const onNextPage = vi.fn();
    const onPreviousPage = vi.fn();
    render(
      <DataPreviewPanel
        {...defaultProps}
        page={2}
        totalRows={300}
        onNextPage={onNextPage}
        onPreviousPage={onPreviousPage}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onNextPage).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onPreviousPage).toHaveBeenCalled();
  });

  it('hides pagination when only one page', () => {
    render(<DataPreviewPanel {...defaultProps} totalRows={10} pageSize={25} />);

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('calculates total pages correctly at exact boundary', () => {
    const { rerender } = render(<DataPreviewPanel {...defaultProps} totalRows={50} pageSize={25} />);
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();

    rerender(<DataPreviewPanel {...defaultProps} totalRows={51} pageSize={25} />);
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  it('renders numbers, booleans, and dates as strings', () => {
    render(
      <DataPreviewPanel
        {...defaultProps}
        columns={['count', 'active', 'created']}
        rows={[{ count: 42, active: true, created: '2024-01-01' }]}
        totalRows={1}
      />,
    );

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
    expect(screen.getByText('2024-01-01')).toBeInTheDocument();
  });
});
