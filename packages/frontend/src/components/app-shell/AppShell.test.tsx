import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from './AppShell';
import type { SchemaDataPort } from '../../ports/schema-data-port';
import type { QueryPort } from '../../ports/query-port';

function createMockSchemaPort(): SchemaDataPort {
  return { fetchTables: vi.fn().mockResolvedValue([]) };
}

function createMockQueryPort(): QueryPort {
  return { submitQuery: vi.fn().mockResolvedValue({}) };
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
    render(<AppShell schemaPort={createMockSchemaPort()} queryPort={createMockQueryPort()} />);

    expect(screen.getByText('Gen BI')).toBeInTheDocument();
    expect(screen.getByLabelText(/host/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument();
    expect(screen.queryByText('Schema Explorer')).not.toBeInTheDocument();
  });

  it('shows sidebar and main content when connectionId exists', () => {
    localStorage.setItem('connectionId', 'conn-1');
    render(<AppShell schemaPort={createMockSchemaPort()} queryPort={createMockQueryPort()} />);

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
    render(<AppShell schemaPort={createMockSchemaPort()} queryPort={createMockQueryPort()} />);

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
    render(<AppShell schemaPort={createMockSchemaPort()} queryPort={createMockQueryPort()} />);

    await waitFor(() => {
      expect(screen.getByText('No tables discovered. Run analysis in Settings first.')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Settings'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    });
  });
});
