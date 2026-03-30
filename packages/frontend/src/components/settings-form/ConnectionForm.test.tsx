import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionForm } from './ConnectionForm';
import { fillAllFields, deferred } from './test-helpers';

// Radix Select does not work reliably in jsdom (portal + pointer-event limitations).
// Replace with a native <select> that calls onValueChange so behaviour tests can
// interact with it using userEvent.selectOptions.
vi.mock('@/components/ui/select', () => {
  const React = require('react');

  // We collect child SelectItem values and labels so we can build <option> elements.
  // The Select root renders a native <select>; SelectItem registers via context.
  const SelectContext = React.createContext<{ onValueChange?: (v: string) => void; value?: string }>({});

  function Select({ value, onValueChange, children }: { value?: string; onValueChange?: (v: string) => void; children: React.ReactNode }) {
    return React.createElement(SelectContext.Provider, { value: { onValueChange, value } }, children);
  }

  // SelectTrigger is the visible element — render as a label-associated native select.
  function SelectTrigger({ id, children: _children }: { id?: string; children?: React.ReactNode }) {
    return React.createElement('div', { id });
  }

  function SelectValue() { return null; }

  // SelectContent wraps the items — render them so SelectItem is mounted.
  function SelectContent({ children }: { children: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }

  // SelectItem renders a button so userEvent.click triggers onValueChange from context.
  function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
    const ctx = React.useContext(SelectContext);
    return React.createElement(
      'button',
      {
        type: 'button',
        'data-testid': `select-item-${value}`,
        onClick: () => ctx.onValueChange?.(value),
      },
      children,
    );
  }

  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

describe('ConnectionForm', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('renders all connection fields', () => {
    render(<ConnectionForm />);
    expect(screen.getByLabelText(/host/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/port/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Database')).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/connection string/i)).toBeInTheDocument();
  });

  it('port field defaults to 5432', () => {
    render(<ConnectionForm />);
    expect(screen.getByLabelText(/port/i)).toHaveValue('5432');
  });

  it('connection string updates as fields are filled', async () => {
    const user = userEvent.setup();
    render(<ConnectionForm />);

    await user.type(screen.getByLabelText(/host/i), 'localhost');
    await user.clear(screen.getByLabelText(/port/i));
    await user.type(screen.getByLabelText(/port/i), '5432');
    await user.type(screen.getByLabelText('Database'), 'mydb');
    await user.type(screen.getByLabelText(/username/i), 'admin');
    await user.type(screen.getByLabelText(/password/i), 'secret');

    expect(screen.getByLabelText(/connection string/i)).toHaveValue('postgresql://admin:secret@localhost:5432/mydb');
  });

  it('editing connection string updates individual fields', async () => {
    const user = userEvent.setup();
    render(<ConnectionForm />);

    const connectionStringInput = screen.getByLabelText(/connection string/i);
    await user.clear(connectionStringInput);
    await user.type(connectionStringInput, 'postgresql://dbuser:pass123@myhost:5433/proddb');

    expect(screen.getByLabelText(/host/i)).toHaveValue('myhost');
    expect(screen.getByLabelText(/port/i)).toHaveValue('5433');
    expect(screen.getByLabelText('Database')).toHaveValue('proddb');
    expect(screen.getByLabelText(/username/i)).toHaveValue('dbuser');
    expect(screen.getByLabelText(/password/i)).toHaveValue('pass123');
  });

  it('connect button is disabled when required fields are empty', () => {
    render(<ConnectionForm />);
    expect(screen.getByRole('button', { name: /connect/i })).toBeDisabled();
  });

  it('connect button is enabled when all fields have values', async () => {
    const user = userEvent.setup();
    render(<ConnectionForm />);
    await fillAllFields(user);
    expect(screen.getByRole('button', { name: /connect/i })).not.toBeDisabled();
  });

  it('saves connection and calls onConnected', async () => {
    const onConnected = vi.fn();
    const fetchSpy = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'saved-id' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const user = userEvent.setup();
    render(<ConnectionForm onConnected={onConnected} />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    expect(fetchSpy).toHaveBeenCalledWith('/api/connections', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        host: 'localhost',
        port: 5432,
        databaseName: 'mydb',
        username: 'admin',
        password: 'secret',
        dbType: 'postgresql',
      }),
    }));

    await screen.findByRole('button', { name: /connected/i });
    expect(onConnected).toHaveBeenCalledWith('saved-id');
    expect(localStorage.getItem('connectionId')).toBe('saved-id');
  });

  it('shows Connecting while saving', async () => {
    const user = userEvent.setup();
    const saveRequest = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => saveRequest.promise));

    render(<ConnectionForm />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    expect(screen.getByRole('button', { name: /connecting/i })).toBeInTheDocument();

    saveRequest.resolve({ ok: true, json: () => Promise.resolve({ id: 'conn-id' }) });
    await screen.findByRole('button', { name: /connected/i });
  });

  it('shows error when save fails', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false }));

    render(<ConnectionForm />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    expect(await screen.findByText('Failed to save connection.')).toBeInTheDocument();
  });

  it('loads previously saved config on mount', async () => {
    localStorage.setItem('connectionId', 'saved-id');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'saved-id',
        host: 'dbhost',
        port: 5433,
        databaseName: 'proddb',
        username: 'dbuser',
        password: 'dbpass',
        dbType: 'postgresql',
      }),
    }));

    render(<ConnectionForm />);
    await screen.findByDisplayValue('dbhost');

    expect(screen.getByLabelText(/host/i)).toHaveValue('dbhost');
    expect(screen.getByLabelText(/port/i)).toHaveValue('5433');
    expect(screen.getByLabelText('Database')).toHaveValue('proddb');
    expect(screen.getByLabelText(/username/i)).toHaveValue('dbuser');
    expect(screen.getByLabelText(/password/i)).toHaveValue('dbpass');
  });

  // ── Slice 2: dbType selector ──────────────────────────────────────────────

  it('renders database-type dropdown with PostgreSQL and SQL Server options', () => {
    render(<ConnectionForm />);
    expect(screen.getByTestId('select-item-postgresql')).toBeInTheDocument();
    expect(screen.getByTestId('select-item-sqlserver')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.getByText('SQL Server')).toBeInTheDocument();
  });

  it('defaults to PostgreSQL on a new connection', () => {
    render(<ConnectionForm />);
    // Port default for postgresql is 5432 — confirms postgresql is selected
    expect(screen.getByLabelText(/port/i)).toHaveValue('5432');
  });

  it('selecting SQL Server sets port to 1433 when port has not been manually edited', async () => {
    const user = userEvent.setup();
    render(<ConnectionForm />);

    await user.click(screen.getByTestId('select-item-sqlserver'));

    expect(screen.getByLabelText(/port/i)).toHaveValue('1433');
  });

  it('selecting PostgreSQL sets port to 5432 when port has not been manually edited', async () => {
    const user = userEvent.setup();
    render(<ConnectionForm />);

    // Switch to SQL Server first, then back to PostgreSQL
    await user.click(screen.getByTestId('select-item-sqlserver'));
    await user.click(screen.getByTestId('select-item-postgresql'));

    expect(screen.getByLabelText(/port/i)).toHaveValue('5432');
  });

  it('does not overwrite port after user manually edits it', async () => {
    const user = userEvent.setup();
    render(<ConnectionForm />);

    // Manually change the port
    await user.clear(screen.getByLabelText(/port/i));
    await user.type(screen.getByLabelText(/port/i), '9999');

    // Switching dbType should NOT overwrite the manually-set port
    await user.click(screen.getByTestId('select-item-sqlserver'));
    expect(screen.getByLabelText(/port/i)).toHaveValue('9999');

    await user.click(screen.getByTestId('select-item-postgresql'));
    expect(screen.getByLabelText(/port/i)).toHaveValue('9999');
  });

  it('loads stored dbType from API when editing an existing connection', async () => {
    localStorage.setItem('connectionId', 'saved-id');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'saved-id',
        host: 'sqlhost',
        port: 1433,
        databaseName: 'SalesDB',
        username: 'sa',
        password: 'pass',
        dbType: 'sqlserver',
      }),
    }));

    render(<ConnectionForm />);
    await screen.findByDisplayValue('sqlhost');

    // Port should be locked to what the API returned, not overwritten by dbType logic
    expect(screen.getByLabelText(/port/i)).toHaveValue('1433');
    // Connection string should be hidden for SQL Server
    expect(screen.queryByLabelText(/connection string/i)).not.toBeInTheDocument();
  });

  it('includes dbType in the POST request body', async () => {
    const fetchSpy = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'new-conn' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const user = userEvent.setup();
    render(<ConnectionForm />);

    await user.click(screen.getByTestId('select-item-sqlserver'));
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.dbType).toBe('sqlserver');
  });

  it('hides connection string for SQL Server', async () => {
    const user = userEvent.setup();
    render(<ConnectionForm />);

    await user.click(screen.getByTestId('select-item-sqlserver'));

    expect(screen.queryByLabelText(/connection string/i)).not.toBeInTheDocument();
  });

  it('shows connection string for PostgreSQL', () => {
    render(<ConnectionForm />);
    expect(screen.getByLabelText(/connection string/i)).toBeInTheDocument();
  });

  it('submit button is disabled when required fields are empty regardless of dbType', async () => {
    const user = userEvent.setup();
    render(<ConnectionForm />);

    await user.click(screen.getByTestId('select-item-sqlserver'));

    expect(screen.getByRole('button', { name: /connect/i })).toBeDisabled();
  });

  it('no Windows-auth or domain fields are rendered for SQL Server', async () => {
    const user = userEvent.setup();
    render(<ConnectionForm />);

    await user.click(screen.getByTestId('select-item-sqlserver'));

    expect(screen.queryByLabelText(/domain/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/windows auth/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/auth type/i)).not.toBeInTheDocument();
  });

  it('encrypt checkbox is not shown for postgresql', () => {
    render(<ConnectionForm />);
    expect(screen.queryByLabelText(/encrypt/i)).not.toBeInTheDocument();
  });

  it('encrypt checkbox is shown when dbType is sqlserver', async () => {
    const user = userEvent.setup();
    render(<ConnectionForm />);

    await user.click(screen.getByTestId('select-item-sqlserver'));

    expect(screen.getByLabelText(/encrypt/i)).toBeInTheDocument();
  });

  it('encrypt checkbox value is included in the submitted body for sqlserver', async () => {
    const fetchSpy = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'new-conn' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const user = userEvent.setup();
    render(<ConnectionForm />);

    await user.click(screen.getByTestId('select-item-sqlserver'));
    await fillAllFields(user);
    await user.click(screen.getByLabelText(/encrypt/i));
    await user.click(screen.getByRole('button', { name: /connect/i }));

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.encrypt).toBe(true);
  });
});
