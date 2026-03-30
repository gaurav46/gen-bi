import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantDatabaseDispatcher } from './tenant-database.dispatcher';
import type { TenantConnectionConfig, TenantDatabasePort } from './tenant-database.port';

function makePostgresAdapter(): TenantDatabasePort {
  return {
    systemSchemaNames: new Set(['information_schema', 'pg_catalog', 'pg_toast']),
    connect: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({ rows: [] }),
    queryIndexes: vi.fn().mockResolvedValue({ rows: [] }),
    disconnect: vi.fn().mockResolvedValue(undefined),
  };
}

function makeSqlServerAdapter(): TenantDatabasePort {
  return {
    systemSchemaNames: new Set(['sys', 'INFORMATION_SCHEMA']),
    connect: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({ rows: [] }),
    queryIndexes: vi.fn().mockResolvedValue({ rows: [] }),
    disconnect: vi.fn().mockResolvedValue(undefined),
  };
}

function makeConfig(dbType: TenantConnectionConfig['dbType']): TenantConnectionConfig {
  return {
    host: 'localhost',
    port: 5432,
    database: 'testdb',
    username: 'user',
    password: 'pass',
    dbType,
  };
}

describe('TenantDatabaseDispatcher', () => {
  let postgresAdapter: TenantDatabasePort;
  let sqlServerAdapter: TenantDatabasePort;
  let dispatcher: TenantDatabaseDispatcher;

  beforeEach(() => {
    postgresAdapter = makePostgresAdapter();
    sqlServerAdapter = makeSqlServerAdapter();
    dispatcher = new TenantDatabaseDispatcher(
      postgresAdapter as never,
      sqlServerAdapter as never,
    );
  });

  describe('systemSchemaNames before connect', () => {
    it('returns an empty Set', () => {
      expect(dispatcher.systemSchemaNames.size).toBe(0);
    });
  });

  describe('connect with dbType postgresql', () => {
    beforeEach(async () => {
      await dispatcher.connect(makeConfig('postgresql'));
    });

    it('calls postgresAdapter.connect with the config', () => {
      expect(postgresAdapter.connect).toHaveBeenCalledWith(makeConfig('postgresql'));
    });

    it('does not call sqlServerAdapter.connect', () => {
      expect(sqlServerAdapter.connect).not.toHaveBeenCalled();
    });

    it('delegates systemSchemaNames to the postgres adapter', () => {
      expect(dispatcher.systemSchemaNames).toBe(postgresAdapter.systemSchemaNames);
    });

    it('delegates query to the postgres adapter', async () => {
      await dispatcher.query('SELECT 1', []);
      expect(postgresAdapter.query).toHaveBeenCalledWith('SELECT 1', []);
    });

    it('delegates queryIndexes to the postgres adapter', async () => {
      await dispatcher.queryIndexes(['public']);
      expect(postgresAdapter.queryIndexes).toHaveBeenCalledWith(['public']);
    });

    it('delegates disconnect to the postgres adapter', async () => {
      await dispatcher.disconnect();
      expect(postgresAdapter.disconnect).toHaveBeenCalled();
    });
  });

  describe('connect with dbType sqlserver', () => {
    beforeEach(async () => {
      await dispatcher.connect(makeConfig('sqlserver'));
    });

    it('calls sqlServerAdapter.connect with the config', () => {
      expect(sqlServerAdapter.connect).toHaveBeenCalledWith(makeConfig('sqlserver'));
    });

    it('does not call postgresAdapter.connect', () => {
      expect(postgresAdapter.connect).not.toHaveBeenCalled();
    });

    it('delegates systemSchemaNames to the sqlserver adapter', () => {
      expect(dispatcher.systemSchemaNames).toBe(sqlServerAdapter.systemSchemaNames);
    });

    it('delegates query to the sqlserver adapter', async () => {
      await dispatcher.query('SELECT 1', []);
      expect(sqlServerAdapter.query).toHaveBeenCalledWith('SELECT 1', []);
    });

    it('delegates queryIndexes to the sqlserver adapter', async () => {
      await dispatcher.queryIndexes(['dbo']);
      expect(sqlServerAdapter.queryIndexes).toHaveBeenCalledWith(['dbo']);
    });

    it('delegates disconnect to the sqlserver adapter', async () => {
      await dispatcher.disconnect();
      expect(sqlServerAdapter.disconnect).toHaveBeenCalled();
    });
  });

  describe('disconnect when not connected', () => {
    it('does not throw', async () => {
      await expect(dispatcher.disconnect()).resolves.not.toThrow();
    });

    it('resets active adapter so systemSchemaNames returns empty Set', async () => {
      await dispatcher.connect(makeConfig('postgresql'));
      await dispatcher.disconnect();
      expect(dispatcher.systemSchemaNames.size).toBe(0);
    });
  });

  describe('query before connect', () => {
    it('throws with a not-connected message', async () => {
      await expect(dispatcher.query('SELECT 1')).rejects.toThrow('not connected');
    });
  });

  describe('queryIndexes before connect', () => {
    it('throws with a not-connected message', async () => {
      await expect(dispatcher.queryIndexes(['public'])).rejects.toThrow('not connected');
    });
  });

  describe('reconnect to a different dbType', () => {
    it('switches the active adapter from postgres to sqlserver', async () => {
      await dispatcher.connect(makeConfig('postgresql'));
      await dispatcher.disconnect();

      await dispatcher.connect(makeConfig('sqlserver'));
      await dispatcher.query('SELECT 1', []);

      expect(sqlServerAdapter.query).toHaveBeenCalledWith('SELECT 1', []);
      expect(postgresAdapter.query).not.toHaveBeenCalled();
    });

    it('switches the active adapter from sqlserver to postgres', async () => {
      await dispatcher.connect(makeConfig('sqlserver'));
      await dispatcher.disconnect();

      await dispatcher.connect(makeConfig('postgresql'));
      await dispatcher.query('SELECT 1', []);

      expect(postgresAdapter.query).toHaveBeenCalledWith('SELECT 1', []);
      expect(sqlServerAdapter.query).not.toHaveBeenCalled();
    });
  });
});
