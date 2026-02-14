import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SettingsForm } from './SettingsForm';

async function fillAllFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/host/i), 'localhost');
  await user.type(screen.getByLabelText(/database/i), 'mydb');
  await user.type(screen.getByLabelText(/username/i), 'admin');
  await user.type(screen.getByLabelText(/password/i), 'secret');
}

function deferred<T>() {
  let resolve: (value: T) => void;
  let reject: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve: resolve!, reject: reject! };
}

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
    expect(screen.getByLabelText(/database/i)).toBeInTheDocument();
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
    await user.type(screen.getByLabelText(/database/i), 'mydb');
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
    expect(screen.getByLabelText(/database/i)).toHaveValue('proddb');
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
      }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);

    await screen.findByDisplayValue('dbhost');

    expect(screen.getByLabelText(/host/i)).toHaveValue('dbhost');
    expect(screen.getByLabelText(/port/i)).toHaveValue('5433');
    expect(screen.getByLabelText(/database/i)).toHaveValue('proddb');
    expect(screen.getByLabelText(/username/i)).toHaveValue('dbuser');
    expect(screen.getByLabelText(/password/i)).toHaveValue('dbpass');

    localStorage.removeItem('connectionId');
    vi.unstubAllGlobals();
  });

  it('shows Connecting progress step when testing connection', async () => {
    const user = userEvent.setup();
    const testRequest = deferred<{ ok: boolean; json: () => Promise<{ schemas: string[] }> }>();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'conn-id' }),
      })
      .mockImplementationOnce(() => testRequest.promise);
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    expect(screen.getByRole('button', { name: /connecting/i })).toBeInTheDocument();

    testRequest.resolve({
      ok: true,
      json: () => Promise.resolve({ schemas: ['public'] }),
    });
    await screen.findByRole('button', { name: /connected/i });
  });

  it('shows Discovering schemas progress step then displays schema list', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'conn-id' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ schemas: ['public', 'sales'] }),
      });
    vi.stubGlobal('fetch', fetchSpy);

    render(<SettingsForm />);
    await fillAllFields(user);
    await user.click(screen.getByRole('button', { name: /connect/i }));

    expect(await screen.findByText('Discovering schemas...')).toBeInTheDocument();
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
    await waitFor(() => expect(analyzeButton).toBeInTheDocument());
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
});
