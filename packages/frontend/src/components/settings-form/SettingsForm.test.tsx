import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SettingsForm } from './SettingsForm';
import { fillAllFields, deferred, mockFetchRoutes, jsonOk } from './test-helpers';

describe('SettingsForm', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('renders Settings heading', () => {
    render(<SettingsForm />);
    expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
  });

  it('renders host, port, database, username, and password fields', () => {
    render(<SettingsForm />);
    expect(screen.getByLabelText(/host/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/port/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Database')).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('port field defaults to 5432', () => {
    render(<SettingsForm />);
    expect(screen.getByLabelText(/port/i)).toHaveValue('5432');
  });

  it('connection string updates as fields are filled', async () => {
    const user = userEvent.setup();
    render(<SettingsForm />);

    await user.type(screen.getByLabelText(/host/i), 'localhost');
    await user.clear(screen.getByLabelText(/port/i));
    await user.type(screen.getByLabelText(/port/i), '5432');
    await user.type(screen.getByLabelText('Database'), 'mydb');
    await user.type(screen.getByLabelText(/username/i), 'admin');
    await user.type(screen.getByLabelText(/password/i), 'secret');

    const connectionStringInput = screen.getByLabelText(/connection string/i);
    expect(connectionStringInput).toHaveValue('postgresql://admin:secret@localhost:5432/mydb');
  });

  it('editing connection string updates individual fields', async () => {
    const user = userEvent.setup();
    render(<SettingsForm />);

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
    render(<SettingsForm />);
    const button = screen.getByRole('button', { name: /connect/i });
    expect(button).toBeDisabled();
  });

  it('connect button is enabled when all fields have values', async () => {
    const user = userEvent.setup();
    render(<SettingsForm />);

    await fillAllFields(user);

    const button = screen.getByRole('button', { name: /connect/i });
    expect(button).not.toBeDisabled();
  });

  it('submits connection config on connect button click', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'saved-id', host: 'localhost', port: 5432, databaseName: 'mydb', username: 'admin' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const user = userEvent.setup();
    render(<SettingsForm />);

    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    expect(fetchSpy).toHaveBeenCalledWith('/api/connections', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: 'localhost',
        port: 5432,
        databaseName: 'mydb',
        username: 'admin',
        password: 'secret',
        dbType: 'postgresql',
      }),
    }));

    vi.unstubAllGlobals();
  });

  it('loads previously saved config on mount', async () => {
    localStorage.setItem('connectionId', 'saved-id');

    const fetchSpy = vi.fn().mockResolvedValue({
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
    });
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);

    await screen.findByDisplayValue('dbhost');

    expect(screen.getByLabelText(/host/i)).toHaveValue('dbhost');
    expect(screen.getByLabelText(/port/i)).toHaveValue('5433');
    expect(screen.getByLabelText('Database')).toHaveValue('proddb');
    expect(screen.getByLabelText(/username/i)).toHaveValue('dbuser');
    expect(screen.getByLabelText(/password/i)).toHaveValue('dbpass');

    localStorage.removeItem('connectionId');
    vi.unstubAllGlobals();
  });

  it('shows Connecting progress step when saving connection', async () => {
    const user = userEvent.setup();
    const saveRequest = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const testDeferred = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => saveRequest.promise)
      .mockImplementationOnce(() => testDeferred.promise));

    render(<SettingsForm />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    expect(screen.getByRole('button', { name: /connecting/i })).toBeInTheDocument();

    saveRequest.resolve({
      ok: true,
      json: () => Promise.resolve({ id: 'conn-id' }),
    });
    expect(await screen.findByText('Discovering schemas...')).toBeInTheDocument();

    testDeferred.resolve({
      ok: true,
      json: () => Promise.resolve({ schemas: ['public'] }),
    });
    expect(await screen.findByRole('checkbox', { name: /public/i })).toBeInTheDocument();
  });

  it('shows Discovering schemas progress step then displays schema list', async () => {
    const user = userEvent.setup();
    const testDeferred = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'conn-id' }),
      })
      .mockImplementationOnce(() => testDeferred.promise);
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    expect(await screen.findByText('Discovering schemas...')).toBeInTheDocument();

    testDeferred.resolve({
      ok: true,
      json: () => Promise.resolve({ schemas: ['public', 'sales'] }),
    });

    expect(await screen.findByRole('checkbox', { name: /public/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /sales/i })).toBeInTheDocument();
  });

  it('shows error message when connection test fails', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'conn-id' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Connection failed: invalid credentials' }),
      });
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    expect(await screen.findByText('Connection failed: invalid credentials')).toBeInTheDocument();
  });

  it('renders checkboxes for each discovered schema', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'conn-id' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ schemas: ['public', 'sales', 'analytics'] }),
      });
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    const publicCheckbox = await screen.findByRole('checkbox', { name: /public/i });
    const salesCheckbox = screen.getByRole('checkbox', { name: /sales/i });
    const analyticsCheckbox = screen.getByRole('checkbox', { name: /analytics/i });

    expect(publicCheckbox).toBeInTheDocument();
    expect(salesCheckbox).toBeInTheDocument();
    expect(analyticsCheckbox).toBeInTheDocument();
    expect(publicCheckbox).not.toBeChecked();
    expect(salesCheckbox).not.toBeChecked();
    expect(analyticsCheckbox).not.toBeChecked();
  });

  it('user can select schemas and click Analyze', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'conn-id' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ schemas: ['public', 'sales', 'analytics'] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tablesDiscovered: 3 }),
      })
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'done', current: 3, total: 3, message: 'Analysis complete' }),
      });
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    const publicCheckbox = await screen.findByRole('checkbox', { name: /public/i });
    const analyticsCheckbox = screen.getByRole('checkbox', { name: /analytics/i });

    await user.click(publicCheckbox);
    await user.click(analyticsCheckbox);

    const analyzeButton = screen.getByRole('button', { name: /analyze/i });
    expect(analyzeButton).toBeEnabled();

    await user.click(analyzeButton);
    await waitFor(() => expect(screen.getByText(/Analysis complete/i)).toBeInTheDocument());
  });

  it('shows error when database has zero non-system schemas', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'conn-id' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'No non-system schemas found' }),
      });
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    expect(await screen.findByText('No non-system schemas found')).toBeInTheDocument();
  });

  it('clicking Analyze sends POST /api/schema/discover with connectionId and selected schemas', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'conn-id' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ schemas: ['public', 'sales'] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ tablesDiscovered: 5 }) })
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: 'done', current: 5, total: 5, message: 'Analysis complete' }) });
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    const publicCheckbox = await screen.findByRole('checkbox', { name: /public/i });
    await user.click(publicCheckbox);
    await user.click(screen.getByRole('button', { name: /analyze/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/api/schema/discover', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: 'conn-id', schemas: ['public'] }),
      }));
    });
  });

  it('shows Analyzing tables progress step with count during analysis', async () => {
    const user = userEvent.setup();
    const analyzeDeferred = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'conn-id' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ schemas: ['public'] }) })
      .mockImplementationOnce(() => analyzeDeferred.promise)
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: 'analyzing', current: 3, total: 12, message: 'Analyzing table 3 of 12' }) });
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    const publicCheckbox = await screen.findByRole('checkbox', { name: /public/i });
    await user.click(publicCheckbox);
    await user.click(screen.getByRole('button', { name: /analyze/i }));

    expect(await screen.findByText(/Analyzing table 3 of 12/i)).toBeInTheDocument();

    analyzeDeferred.resolve({ ok: true, json: () => Promise.resolve({ tablesDiscovered: 12 }) });
  });

  it('shows completion message when analysis finishes', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'conn-id' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ schemas: ['public'] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ tablesDiscovered: 5 }) })
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: 'done', current: 5, total: 5, message: 'Analysis complete' }) });
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    const publicCheckbox = await screen.findByRole('checkbox', { name: /public/i });
    await user.click(publicCheckbox);
    await user.click(screen.getByRole('button', { name: /analyze/i }));

    expect(await screen.findByText(/Analysis complete/i)).toBeInTheDocument();
  });

  it('shows error message when analysis fails', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'conn-id' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ schemas: ['public'] }) })
      .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ message: 'No tables found in selected schemas' }) });
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    const publicCheckbox = await screen.findByRole('checkbox', { name: /public/i });
    await user.click(publicCheckbox);
    await user.click(screen.getByRole('button', { name: /analyze/i }));

    expect(await screen.findByText(/No tables found in selected schemas/i)).toBeInTheDocument();
  });

  it('Analyze button is disabled when no schemas are selected', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'conn-id' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ schemas: ['public'] }),
      });
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    const publicCheckbox = await screen.findByRole('checkbox', { name: /public/i });
    const analyzeButton = screen.getByRole('button', { name: /analyze/i });

    expect(analyzeButton).toBeDisabled();

    await user.click(publicCheckbox);
    expect(analyzeButton).toBeEnabled();

    await user.click(publicCheckbox);
    expect(analyzeButton).toBeDisabled();
  });

  it('hides connection form after successful connection', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'conn-id' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ schemas: ['public'] }) });
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    await screen.findByRole('checkbox', { name: /public/i });
    expect(screen.queryByLabelText(/host/i)).not.toBeInTheDocument();
  });

  it('shows progress bar and numeric progress during analysis', async () => {
    const user = userEvent.setup();
    const analyzeDeferred = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'conn-id' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ schemas: ['public'] }) })
      .mockImplementationOnce(() => analyzeDeferred.promise)
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: 'analyzing', current: 3, total: 12, message: 'Analyzing orders' }) });
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    const publicCheckbox = await screen.findByRole('checkbox', { name: /public/i });
    await user.click(publicCheckbox);
    await user.click(screen.getByRole('button', { name: /analyze/i }));

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText(/3 of 12/)).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: /public/i })).not.toBeInTheDocument();
    });

    analyzeDeferred.resolve({ ok: true, json: () => Promise.resolve({}) });
  });

  it('Change connection from schema selection returns to connection form', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'conn-id' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ schemas: ['public'] }) });
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    await screen.findByRole('checkbox', { name: /public/i });
    await user.click(screen.getByRole('button', { name: /change connection/i }));

    expect(await screen.findByLabelText(/host/i)).toBeInTheDocument();
  });

  it('Change connection from progress screen returns to connection form', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'conn-id' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ schemas: ['public'] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ tablesDiscovered: 5 }) })
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: 'done', current: 5, total: 5, message: 'Analysis complete' }) });
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    const publicCheckbox = await screen.findByRole('checkbox', { name: /public/i });
    await user.click(publicCheckbox);
    await user.click(screen.getByRole('button', { name: /analyze/i }));

    await screen.findByText(/Analysis complete/i);
    await user.click(screen.getByRole('button', { name: /change connection/i }));

    expect(await screen.findByLabelText(/host/i)).toBeInTheDocument();
  });

  it('shows progress screen on mount when backend reports analyzing', async () => {
    localStorage.setItem('connectionId', 'saved-conn');
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'analyzing', current: 5, total: 10, message: 'Analyzing users' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
    expect(screen.getByText(/5 of 10/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/host/i)).not.toBeInTheDocument();
  });

  it('retry after analysis error re-triggers analysis', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'conn-id' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ schemas: ['public'] }) })
      .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ message: 'Analysis failed' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ tablesDiscovered: 5 }) })
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: 'done', current: 5, total: 5, message: 'Analysis complete' }) });
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    const publicCheckbox = await screen.findByRole('checkbox', { name: /public/i });
    await user.click(publicCheckbox);
    await user.click(screen.getByRole('button', { name: /analyze/i }));

    await screen.findByText('Analysis failed');
    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText(/Analysis complete/i)).toBeInTheDocument();
  });

  it('shows annotation screen when status is introspected', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn().mockImplementation(mockFetchRoutes({
      'POST /api/connections': jsonOk({ id: 'conn-id' }),
      'POST /api/connections/conn-id/test': jsonOk({ schemas: ['public'] }),
      'POST /api/schema/discover': jsonOk({ tablesDiscovered: 2 }),
      'GET /api/schema/discover/status': jsonOk({ status: 'introspected', current: 2, total: 2, message: 'Introspection complete' }),
      'GET /api/schema/conn-id/annotations': jsonOk({
        columns: [{
          columnId: 'col-1', tableName: 'orders', schemaName: 'public',
          columnName: 'amt_1', dataType: 'numeric', suggestedDescription: 'Amount',
        }],
      }),
    }));
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));
    await screen.findByText(/public/i);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /analyze/i }));

    expect(await screen.findByTestId('annotation-screen')).toBeInTheDocument();
  });

  it('annotation screen shows fetched ambiguous columns', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn().mockImplementation(mockFetchRoutes({
      'POST /api/connections': jsonOk({ id: 'conn-id' }),
      'POST /api/connections/conn-id/test': jsonOk({ schemas: ['public'] }),
      'POST /api/schema/discover': jsonOk({ tablesDiscovered: 2 }),
      'GET /api/schema/discover/status': jsonOk({ status: 'introspected', current: 2, total: 2, message: '' }),
      'GET /api/schema/conn-id/annotations': jsonOk({
        columns: [{
          columnId: 'col-1', tableName: 'orders', schemaName: 'public',
          columnName: 'amt_1', dataType: 'numeric', suggestedDescription: 'Order subtotal amount',
        }],
      }),
    }));
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));
    await screen.findByText(/public/i);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /analyze/i }));

    expect(await screen.findByText('amt_1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Order subtotal amount')).toBeInTheDocument();
  });

  it('annotation flow: introspect -> annotate -> embed', async () => {
    const user = userEvent.setup();
    let embedTriggered = false;
    const fetchSpy = vi.fn().mockImplementation(mockFetchRoutes({
      'POST /api/connections': jsonOk({ id: 'conn-id' }),
      'POST /api/connections/conn-id/test': jsonOk({ schemas: ['public'] }),
      'POST /api/schema/discover': jsonOk({ tablesDiscovered: 2 }),
      'GET /api/schema/discover/status': () => {
        if (embedTriggered) {
          return jsonOk({ status: 'done', current: 2, total: 2, message: 'Analysis complete' });
        }
        return jsonOk({ status: 'introspected', current: 2, total: 2, message: '' });
      },
      'GET /api/schema/conn-id/annotations': jsonOk({
        columns: [{
          columnId: 'col-1', tableName: 'orders', schemaName: 'public',
          columnName: 'amt_1', dataType: 'numeric', suggestedDescription: 'Order subtotal amount',
        }],
      }),
      'PATCH /api/schema/conn-id/annotations': jsonOk({ updated: 1 }),
      'POST /api/schema/conn-id/embed': () => {
        embedTriggered = true;
        return jsonOk({ status: 'started' });
      },
    }));
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    const publicCheckbox = await screen.findByRole('checkbox', { name: /public/i });
    await user.click(publicCheckbox);
    await user.click(screen.getByRole('button', { name: /analyze/i }));

    expect(await screen.findByText('amt_1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Order subtotal amount')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByText(/Analysis complete/i)).toBeInTheDocument();
  });

  it('shows completion screen on mount when backend reports done', async () => {
    localStorage.setItem('connectionId', 'saved-conn');
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'done', current: 10, total: 10, message: 'Complete' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);

    expect(await screen.findByText(/Analysis complete/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/host/i)).not.toBeInTheDocument();
  });

  it('Continue button saves annotations and triggers embedding', async () => {
    const user = userEvent.setup();
    let embedTriggered = false;
    const fetchSpy = vi.fn().mockImplementation(mockFetchRoutes({
      'POST /api/connections': jsonOk({ id: 'conn-id' }),
      'POST /api/connections/conn-id/test': jsonOk({ schemas: ['public'] }),
      'POST /api/schema/discover': jsonOk({ tablesDiscovered: 2 }),
      'GET /api/schema/discover/status': () => {
        if (embedTriggered) {
          return jsonOk({ status: 'done', current: 2, total: 2, message: 'Analysis complete' });
        }
        return jsonOk({ status: 'introspected', current: 2, total: 2, message: '' });
      },
      'GET /api/schema/conn-id/annotations': jsonOk({
        columns: [{
          columnId: 'col-1', tableName: 'orders', schemaName: 'public',
          columnName: 'amt_1', dataType: 'numeric', suggestedDescription: 'Order subtotal amount',
        }],
      }),
      'PATCH /api/schema/conn-id/annotations': jsonOk({ updated: 1 }),
      'POST /api/schema/conn-id/embed': () => {
        embedTriggered = true;
        return jsonOk({ status: 'started' });
      },
    }));
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    const publicCheckbox = await screen.findByRole('checkbox', { name: /public/i });
    await user.click(publicCheckbox);
    await user.click(screen.getByRole('button', { name: /analyze/i }));

    expect(await screen.findByText('amt_1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByText(/Analysis complete/i)).toBeInTheDocument();
  });

  it('Skip button triggers embedding without saving annotations', async () => {
    const user = userEvent.setup();
    let embedTriggered = false;
    const fetchCalls: string[] = [];
    const fetchSpy = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      const method = options?.method ?? 'GET';
      fetchCalls.push(`${method} ${url}`);
      const routes = mockFetchRoutes({
        'POST /api/connections': jsonOk({ id: 'conn-id' }),
        'POST /api/connections/conn-id/test': jsonOk({ schemas: ['public'] }),
        'POST /api/schema/discover': jsonOk({ tablesDiscovered: 2 }),
        'GET /api/schema/discover/status': () => {
          if (embedTriggered) {
            return jsonOk({ status: 'done', current: 2, total: 2, message: 'Analysis complete' });
          }
          return jsonOk({ status: 'introspected', current: 2, total: 2, message: '' });
        },
        'GET /api/schema/conn-id/annotations': jsonOk({
          columns: [{
            columnId: 'col-1', tableName: 'orders', schemaName: 'public',
            columnName: 'amt_1', dataType: 'numeric', suggestedDescription: 'Order subtotal amount',
          }],
        }),
        'POST /api/schema/conn-id/embed': () => {
          embedTriggered = true;
          return jsonOk({ status: 'started' });
        },
      });
      return routes(url, options);
    });
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    const publicCheckbox = await screen.findByRole('checkbox', { name: /public/i });
    await user.click(publicCheckbox);
    await user.click(screen.getByRole('button', { name: /analyze/i }));

    expect(await screen.findByText('amt_1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /skip/i }));

    expect(await screen.findByText(/Analysis complete/i)).toBeInTheDocument();
    expect(fetchCalls).not.toContain('PATCH /api/schema/conn-id/annotations');
    expect(fetchCalls).toContain('POST /api/schema/conn-id/embed');
  });
});
