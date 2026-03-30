import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from 'pg';
import { TenantDatabaseAdapter } from './tenant-database.adapter';

vi.mock('pg', () => ({
  Client: vi.fn(),
}));

describe('TenantDatabaseAdapter', () => {
  const connectMock = vi.fn();
  const queryMock = vi.fn();
  const endMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Client).mockImplementation(
      function mockedPgClientConstructor() {
        return {
          connect: connectMock,
          query: queryMock,
          end: endMock,
        } as never;
      }
    );
  });

  it('connects with default_transaction_read_only set to on', async () => {
    const adapter = new TenantDatabaseAdapter();

    await adapter.connect({
      host: 'localhost',
      port: 5432,
      database: 'tenant_db',
      username: 'tenant_user',
      password: 'tenant_password',
      dbType: 'postgresql' as const,
    });

    expect(Client).toHaveBeenCalledWith({
      host: 'localhost',
      port: 5432,
      database: 'tenant_db',
      user: 'tenant_user',
      password: 'tenant_password',
    });
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(queryMock).toHaveBeenCalledWith('SET default_transaction_read_only = on');
  });

  it('query delegates to pg client and returns rows', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ schema_name: 'public' }] });

    const adapter = new TenantDatabaseAdapter();
    await adapter.connect({
      host: 'localhost',
      port: 5432,
      database: 'tenant_db',
      username: 'tenant_user',
      password: 'tenant_password',
      dbType: 'postgresql' as const,
    });

    const result = await adapter.query('SELECT schema_name FROM information_schema.schemata');

    expect(queryMock).toHaveBeenLastCalledWith('SELECT schema_name FROM information_schema.schemata');
    expect(result).toEqual({ rows: [{ schema_name: 'public' }] });
  });

  it('disconnect ends the pg client connection', async () => {
    const adapter = new TenantDatabaseAdapter();

    await adapter.connect({
      host: 'localhost',
      port: 5432,
      database: 'tenant_db',
      username: 'tenant_user',
      password: 'tenant_password',
      dbType: 'postgresql' as const,
    });
    await adapter.disconnect();

    expect(endMock).toHaveBeenCalledTimes(1);
  });

  it('throws descriptive error when connection fails', async () => {
    connectMock.mockRejectedValueOnce(new Error('connection refused'));
    const adapter = new TenantDatabaseAdapter();

    await expect(
      adapter.connect({
        host: 'localhost',
        port: 5432,
        database: 'tenant_db',
        username: 'tenant_user',
        password: 'tenant_password',
        dbType: 'postgresql' as const,
      })
    ).rejects.toThrow('Failed to connect to tenant database');
  });

  it('adapter rejects queries that are not SELECT statements', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error('cannot execute DROP TABLE in a read-only transaction'));

    const adapter = new TenantDatabaseAdapter();
    await adapter.connect({
      host: 'localhost',
      port: 5432,
      database: 'tenant_db',
      username: 'tenant_user',
      password: 'tenant_password',
      dbType: 'postgresql' as const,
    });

    await expect(adapter.query('DROP TABLE users')).rejects.toThrow('read-only');
  });

  it('disconnect handles already-disconnected client gracefully', async () => {
    endMock.mockRejectedValueOnce(new Error('client already closed'));
    const adapter = new TenantDatabaseAdapter();

    await adapter.connect({
      host: 'localhost',
      port: 5432,
      database: 'tenant_db',
      username: 'tenant_user',
      password: 'tenant_password',
      dbType: 'postgresql' as const,
    });

    await expect(adapter.disconnect()).resolves.toBeUndefined();
  });

  it('returns meaningful error for invalid credentials', async () => {
    connectMock.mockRejectedValueOnce({
      code: '28P01',
      message: 'password authentication failed',
    });
    const adapter = new TenantDatabaseAdapter();

    await expect(
      adapter.connect({
        host: 'localhost',
        port: 5432,
        database: 'tenant_db',
        username: 'tenant_user',
        password: 'bad-password',
        dbType: 'postgresql' as const,
      })
    ).rejects.toThrow('Invalid credentials');
  });

  it('returns meaningful error for unreachable host', async () => {
    connectMock.mockRejectedValueOnce({
      code: 'ECONNREFUSED',
      message: 'connect ECONNREFUSED 127.0.0.1:5432',
    });
    const adapter = new TenantDatabaseAdapter();

    await expect(
      adapter.connect({
        host: '127.0.0.1',
        port: 5432,
        database: 'tenant_db',
        username: 'tenant_user',
        password: 'tenant_password',
        dbType: 'postgresql' as const,
      })
    ).rejects.toThrow('Unable to reach tenant database host');
  });

  // Slice 4 — systemSchemaNames property
  describe('systemSchemaNames', () => {
    it('contains information_schema', () => {
      const adapter = new TenantDatabaseAdapter();
      expect(adapter.systemSchemaNames.has('information_schema')).toBe(true);
    });

    it('contains pg_catalog', () => {
      const adapter = new TenantDatabaseAdapter();
      expect(adapter.systemSchemaNames.has('pg_catalog')).toBe(true);
    });

    it('contains pg_toast', () => {
      const adapter = new TenantDatabaseAdapter();
      expect(adapter.systemSchemaNames.has('pg_toast')).toBe(true);
    });

    it('contains exactly three entries and no others', () => {
      const adapter = new TenantDatabaseAdapter();
      expect(adapter.systemSchemaNames.size).toBe(3);
    });

    it('does not contain public or any user schema', () => {
      const adapter = new TenantDatabaseAdapter();
      expect(adapter.systemSchemaNames.has('public')).toBe(false);
    });
  });
});
