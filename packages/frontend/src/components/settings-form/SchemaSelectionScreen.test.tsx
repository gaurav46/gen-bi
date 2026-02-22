import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SchemaSelectionScreen } from './SchemaSelectionScreen';

describe('SchemaSelectionScreen', () => {
  const defaultProps = {
    discoveredSchemas: ['public', 'sales'],
    selectedSchemas: [] as string[],
    toggleSchema: vi.fn(),
    analyze: vi.fn(),
    status: 'ready' as const,
    errorMessage: '',
    onChangeConnection: vi.fn(),
  };

  it('renders a checkbox for each discovered schema', () => {
    render(<SchemaSelectionScreen {...defaultProps} />);

    expect(screen.getByRole('checkbox', { name: /public/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /sales/i })).toBeInTheDocument();
  });

  it('Analyze button is disabled when no schemas are selected', () => {
    render(<SchemaSelectionScreen {...defaultProps} selectedSchemas={[]} />);

    expect(screen.getByRole('button', { name: /analyze/i })).toBeDisabled();
  });

  it('Change connection link calls onChangeConnection', async () => {
    const onChangeConnection = vi.fn();
    const user = userEvent.setup();
    render(<SchemaSelectionScreen {...defaultProps} onChangeConnection={onChangeConnection} />);

    await user.click(screen.getByRole('button', { name: /change connection/i }));

    expect(onChangeConnection).toHaveBeenCalled();
  });

  it('shows error message when provided', () => {
    render(
      <SchemaSelectionScreen
        {...defaultProps}
        status="error"
        errorMessage="Connection failed: invalid credentials"
      />,
    );

    expect(screen.getByText('Connection failed: invalid credentials')).toBeInTheDocument();
  });
});
