import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionForm } from './ConnectionForm';

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
    expect(screen.getByLabelText(/database/i)).toBeInTheDocument();
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
    await user.type(screen.getByLabelText(/database/i), 'mydb');
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
    expect(screen.getByLabelText(/database/i)).toHaveValue('proddb');
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
      }),
    }));

    render(<ConnectionForm />);
    await screen.findByDisplayValue('dbhost');

    expect(screen.getByLabelText(/host/i)).toHaveValue('dbhost');
    expect(screen.getByLabelText(/port/i)).toHaveValue('5433');
    expect(screen.getByLabelText(/database/i)).toHaveValue('proddb');
    expect(screen.getByLabelText(/username/i)).toHaveValue('dbuser');
    expect(screen.getByLabelText(/password/i)).toHaveValue('dbpass');
  });
});
