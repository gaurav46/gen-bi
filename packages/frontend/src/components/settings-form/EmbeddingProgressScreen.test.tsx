import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { EmbeddingProgressScreen } from './EmbeddingProgressScreen';

describe('EmbeddingProgressScreen', () => {
  const defaultProps = {
    status: 'analyzing' as const,
    analysisMessage: 'Analyzing table orders',
    current: 3,
    total: 12,
    errorMessage: '',
    analyze: vi.fn(),
    onChangeConnection: vi.fn(),
  };

  it('shows the current analysis message', () => {
    render(<EmbeddingProgressScreen {...defaultProps} />);

    expect(screen.getByText('Analyzing table orders')).toBeInTheDocument();
  });

  it('shows numeric progress as N of M tables', () => {
    render(<EmbeddingProgressScreen {...defaultProps} />);

    expect(screen.getByText(/3 of 12 tables/)).toBeInTheDocument();
  });

  it('renders a progress bar reflecting completion percentage', () => {
    render(<EmbeddingProgressScreen {...defaultProps} />);

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
  });

  it('shows success summary when analysis is done', () => {
    render(
      <EmbeddingProgressScreen
        {...defaultProps}
        status="done"
        current={12}
        total={12}
        analysisMessage="Analysis complete"
      />,
    );

    expect(screen.getByText('Analysis complete')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows error message and retry button when analysis fails', async () => {
    const analyze = vi.fn();
    const user = userEvent.setup();
    render(
      <EmbeddingProgressScreen
        {...defaultProps}
        status="error"
        errorMessage="Analysis failed"
        analyze={analyze}
      />,
    );

    expect(screen.getByText('Analysis failed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(analyze).toHaveBeenCalled();
  });

  it('progress bar shows 0% when total is 0', () => {
    render(
      <EmbeddingProgressScreen
        {...defaultProps}
        current={0}
        total={0}
      />,
    );

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(screen.getByText(/0 of 0 tables/)).toBeInTheDocument();
  });

  it('Change connection link calls onChangeConnection', async () => {
    const onChangeConnection = vi.fn();
    const user = userEvent.setup();
    render(<EmbeddingProgressScreen {...defaultProps} onChangeConnection={onChangeConnection} />);

    await user.click(screen.getByRole('button', { name: /change connection/i }));
    expect(onChangeConnection).toHaveBeenCalled();
  });
});
