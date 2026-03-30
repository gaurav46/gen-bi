import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock mssql — use vi.hoisted() so references survive Vitest's mock hoisting
// ---------------------------------------------------------------------------

const { mockRequest, mockPool } = vi.hoisted(() => {
  const mockRequest = {
    input: vi.fn(),
    query: vi.fn().mockResolvedValue({ recordset: [] }),
  };
  const mockPool = {
    connect: vi.fn().mockResolvedValue(undefined),
    request: vi.fn().mockReturnValue(mockRequest),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return { mockRequest, mockPool };
});

// ConnectionPool must be a real constructor function (not an arrow fn) because
// the production code calls `new ConnectionPool(...)`.
vi.mock('mssql', () => {
  const ConnectionPool = vi.fn().mockImplementation(function () {
    return mockPool;
  });
  return { ConnectionPool };
});

// ---------------------------------------------------------------------------
// Imports — after vi.mock()
// ---------------------------------------------------------------------------

import { SqlServerTenantDatabaseAdapter } from './sqlserver-tenant-database.adapter';
import type { TenantConnectionConfig } from './tenant-database.port';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<TenantConnectionConfig> = {}): TenantConnectionConfig {
  return {
    host: 'sqlserver.example.com',
    port: 1433,
    database: 'testdb',
    username: 'sa',
    password: 'secret',
    dbType: 'sqlserver',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SqlServerTenantDatabaseAdapter', () => {
  let adapter: SqlServerTenantDatabaseAdapter;

  beforeEach(async () => {
    adapter = new SqlServerTenantDatabaseAdapter();
    vi.clearAllMocks();
    mockPool.connect.mockResolvedValue(undefined);
    mockPool.request.mockReturnValue(mockRequest);
    mockRequest.input.mockReturnValue(undefined);
    mockRequest.query.mockResolvedValue({ recordset: [] });
    mockPool.close.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // systemSchemaNames
  // -------------------------------------------------------------------------

  describe('systemSchemaNames', () => {
    it('contains all required SQL Server system schemas', () => {
      const names = adapter.systemSchemaNames;
      expect(names.has('sys')).toBe(true);
      expect(names.has('INFORMATION_SCHEMA')).toBe(true);
      expect(names.has('db_owner')).toBe(true);
      expect(names.has('db_datareader')).toBe(true);
      expect(names.has('db_datawriter')).toBe(true);
    });

    it('does not contain user-schema names', () => {
      expect(adapter.systemSchemaNames.has('dbo')).toBe(false);
      expect(adapter.systemSchemaNames.has('public')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // connect
  // -------------------------------------------------------------------------

  describe('connect', () => {
    it('opens a ConnectionPool with the given config', async () => {
      const { ConnectionPool } = await import('mssql');
      await adapter.connect(makeConfig());
      expect(ConnectionPool).toHaveBeenCalledWith(
        expect.objectContaining({
          server: 'sqlserver.example.com',
          port: 1433,
          database: 'testdb',
          user: 'sa',
          password: 'secret',
        }),
      );
      expect(mockPool.connect).toHaveBeenCalled();
    });

    it('sets encrypt=false and trustServerCertificate=true when encrypt is absent', async () => {
      const { ConnectionPool } = await import('mssql');
      await adapter.connect(makeConfig());
      expect(ConnectionPool).toHaveBeenCalledWith(
        expect.objectContaining({
          options: { encrypt: false, trustServerCertificate: true },
        }),
      );
    });

    it('sets encrypt=true and trustServerCertificate=false when encrypt=true', async () => {
      const { ConnectionPool } = await import('mssql');
      await adapter.connect(makeConfig({ encrypt: true }));
      expect(ConnectionPool).toHaveBeenCalledWith(
        expect.objectContaining({
          options: { encrypt: true, trustServerCertificate: false },
        }),
      );
    });

    it('maps login failure (number 18456) to friendly message', async () => {
      const loginError = Object.assign(new Error('Login failed for user'), { number: 18456 });
      mockPool.connect.mockRejectedValue(loginError);
      await expect(adapter.connect(makeConfig())).rejects.toThrow('Invalid credentials for tenant database');
    });

    it('maps "Login failed" message to friendly credentials error', async () => {
      const loginError = new Error('Login failed for user sa');
      mockPool.connect.mockRejectedValue(loginError);
      await expect(adapter.connect(makeConfig())).rejects.toThrow('Invalid credentials for tenant database');
    });

    it('maps ECONNREFUSED to friendly unreachable message', async () => {
      const connError = Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:1433'), { code: 'ECONNREFUSED' });
      mockPool.connect.mockRejectedValue(connError);
      await expect(adapter.connect(makeConfig())).rejects.toThrow('Unable to reach tenant database host');
    });

    it('maps ECONNREFUSED in message to friendly unreachable message', async () => {
      const connError = new Error('connect ECONNREFUSED');
      mockPool.connect.mockRejectedValue(connError);
      await expect(adapter.connect(makeConfig())).rejects.toThrow('Unable to reach tenant database host');
    });

    it('wraps unknown errors with generic message', async () => {
      mockPool.connect.mockRejectedValue(new Error('TLS handshake failed'));
      await expect(adapter.connect(makeConfig())).rejects.toThrow('Failed to connect to tenant database: TLS handshake failed');
    });
  });

  // -------------------------------------------------------------------------
  // query — parameter translation
  // -------------------------------------------------------------------------

  describe('query — $N → @pN translation', () => {
    beforeEach(async () => {
      await adapter.connect(makeConfig());
      vi.clearAllMocks();
      mockPool.request.mockReturnValue(mockRequest);
      mockRequest.input.mockReturnValue(undefined);
      mockRequest.query.mockResolvedValue({ recordset: [] });
    });

    it('passes SQL unchanged when params array is empty', async () => {
      await adapter.query('SELECT 1', []);
      expect(mockRequest.query).toHaveBeenCalledWith('SELECT 1');
      expect(mockRequest.input).not.toHaveBeenCalled();
    });

    it('passes SQL unchanged when params are absent', async () => {
      await adapter.query('SELECT 1');
      expect(mockRequest.query).toHaveBeenCalledWith('SELECT 1');
      expect(mockRequest.input).not.toHaveBeenCalled();
    });

    it('translates a single $1 placeholder to @p1', async () => {
      await adapter.query('SELECT * FROM t WHERE name = $1', ['alice']);
      expect(mockRequest.query).toHaveBeenCalledWith('SELECT * FROM t WHERE name = @p1');
      expect(mockRequest.input).toHaveBeenCalledWith('p1', 'alice');
    });

    it('translates multiple $N placeholders in positional order', async () => {
      await adapter.query('SELECT * FROM t WHERE a = $1 AND b = $2', ['foo', 42]);
      expect(mockRequest.query).toHaveBeenCalledWith('SELECT * FROM t WHERE a = @p1 AND b = @p2');
      expect(mockRequest.input).toHaveBeenCalledWith('p1', 'foo');
      expect(mockRequest.input).toHaveBeenCalledWith('p2', 42);
    });

    it('returns rows from recordset wrapped in { rows }', async () => {
      mockRequest.query.mockResolvedValue({ recordset: [{ id: 1, name: 'foo' }] });
      const result = await adapter.query('SELECT id, name FROM t', []);
      expect(result).toEqual({ rows: [{ id: 1, name: 'foo' }] });
    });

    it('throws if called before connect', async () => {
      const fresh = new SqlServerTenantDatabaseAdapter();
      await expect(fresh.query('SELECT 1')).rejects.toThrow('not connected');
    });
  });

  // -------------------------------------------------------------------------
  // disconnect
  // -------------------------------------------------------------------------

  describe('disconnect', () => {
    it('calls pool.close() and clears the pool reference', async () => {
      await adapter.connect(makeConfig());
      vi.clearAllMocks();
      mockPool.close.mockResolvedValue(undefined);

      await adapter.disconnect();

      expect(mockPool.close).toHaveBeenCalled();
    });

    it('is a no-op if called before connect', async () => {
      const fresh = new SqlServerTenantDatabaseAdapter();
      await expect(fresh.disconnect()).resolves.not.toThrow();
    });

    it('does not throw if pool.close() rejects', async () => {
      await adapter.connect(makeConfig());
      vi.clearAllMocks();
      mockPool.close.mockRejectedValue(new Error('already closed'));

      await expect(adapter.disconnect()).resolves.not.toThrow();
    });

    it('allows reconnect after disconnect', async () => {
      const { ConnectionPool } = await import('mssql');
      await adapter.connect(makeConfig());
      await adapter.disconnect();
      vi.clearAllMocks();
      mockPool.connect.mockResolvedValue(undefined);

      await adapter.connect(makeConfig());
      expect(ConnectionPool).toHaveBeenCalledTimes(1);
    });
  });
});
