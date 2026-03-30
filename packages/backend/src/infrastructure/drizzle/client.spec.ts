/**
 * Slice 3: createDrizzleClient factory unit tests
 *
 * All external dependencies are mocked — no real DuckDB files or Postgres
 * connections are opened during these tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module-level mocks — declared before any imports that use them
// ---------------------------------------------------------------------------

// Mock fs so ensureDirectoryExists never touches the real file system
vi.mock('fs', () => ({
  mkdirSync: vi.fn(),
}));

// Mock @duckdb/node-api to avoid any real DuckDB I/O
vi.mock('@duckdb/node-api', () => {
  const mockConnection = {
    run: vi.fn().mockResolvedValue(undefined),
    runAndReadAll: vi.fn().mockResolvedValue({ getRowObjects: () => [] }),
  };
  const mockInstance = {
    connect: vi.fn().mockResolvedValue(mockConnection),
  };
  return {
    DuckDBInstance: {
      create: vi.fn().mockResolvedValue(mockInstance),
    },
  };
});

// Mock pg so no real Postgres pool is opened.
// Pool must be a real constructor function (not an arrow fn) because the
// production code calls `new Pool(...)`.
vi.mock('pg', () => {
  function Pool(this: Record<string, unknown>, _config: unknown) {
    this.query = vi.fn();
    this.end = vi.fn();
  }
  Pool.mockCalls = [] as unknown[];
  // Track calls manually so we can use expect(Pool).toHaveBeenCalled()
  const PoolSpy = vi.fn().mockImplementation(function (config: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new (Pool as any)(config);
  });
  return { Pool: PoolSpy };
});

// Mock drizzle-orm/node-postgres so we control what it returns without a real pg connection
vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn().mockReturnValue({ _tag: 'pg-drizzle-mock' }),
}));

// Mock drizzle-orm/pg-proxy so the DuckDB path also returns a controlled object
vi.mock('drizzle-orm/pg-proxy', () => ({
  drizzle: vi.fn().mockReturnValue({ _tag: 'duckdb-drizzle-mock' }),
}));

// ---------------------------------------------------------------------------
// Imports — placed after vi.mock() calls
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import { Pool } from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzleProxy } from 'drizzle-orm/pg-proxy';
import { DRIZZLE_CLIENT, createDrizzleClient } from './client';

// ---------------------------------------------------------------------------
// AC: DRIZZLE_CLIENT constant value
// ---------------------------------------------------------------------------

describe('Slice 3 AC: DRIZZLE_CLIENT constant', () => {
  it("DRIZZLE_CLIENT equals the string 'DRIZZLE_CLIENT'", () => {
    expect(DRIZZLE_CLIENT).toBe('DRIZZLE_CLIENT');
  });

  it('DRIZZLE_CLIENT is a string (injectable as a NestJS token)', () => {
    expect(typeof DRIZZLE_CLIENT).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// AC: DATABASE_ENGINE=duckdb (default)
// ---------------------------------------------------------------------------

describe('Slice 3 AC: createDrizzleClient() with DATABASE_ENGINE=duckdb', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_ENGINE', 'duckdb');
    vi.stubEnv('DUCKDB_PATH', '/tmp/test-genbi.db');
    // Ensure DATABASE_URL is absent so we can assert it's not read
    vi.stubEnv('DATABASE_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('returns a Drizzle client without throwing', async () => {
    await expect(createDrizzleClient()).resolves.not.toThrow();
  });

  it('dynamically imports @duckdb/node-api', async () => {
    const { DuckDBInstance } = await import('@duckdb/node-api');
    await createDrizzleClient();
    expect(DuckDBInstance.create).toHaveBeenCalled();
  });

  it('opens the DuckDB file at the DUCKDB_PATH env var', async () => {
    const { DuckDBInstance } = await import('@duckdb/node-api');
    await createDrizzleClient();
    expect(DuckDBInstance.create).toHaveBeenCalledWith('/tmp/test-genbi.db');
  });

  it('creates the directory for DUCKDB_PATH before opening the file', async () => {
    await createDrizzleClient();
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      expect.any(String),
      { recursive: true },
    );
  });

  it('loads the VSS extension after opening the connection', async () => {
    const { DuckDBInstance } = await import('@duckdb/node-api');
    await createDrizzleClient();
    const mockInstance = await DuckDBInstance.create('/tmp/test-genbi.db');
    const mockConnection = await mockInstance.connect();
    expect(mockConnection.run).toHaveBeenCalledWith('LOAD vss');
  });

  it('does NOT create a pg.Pool (no Postgres connection attempt)', async () => {
    await createDrizzleClient();
    expect(Pool).not.toHaveBeenCalled();
  });

  it('does NOT call drizzle-orm/node-postgres drizzle (Postgres driver)', async () => {
    await createDrizzleClient();
    expect(drizzlePg).not.toHaveBeenCalled();
  });

  it('uses the pg-proxy drizzle adapter (DuckDB remote callback path)', async () => {
    await createDrizzleClient();
    expect(drizzleProxy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC: DATABASE_ENGINE unset — defaults to duckdb behaviour
// ---------------------------------------------------------------------------

describe('Slice 3 AC: createDrizzleClient() when DATABASE_ENGINE is unset', () => {
  beforeEach(() => {
    // Explicitly delete the env var to simulate "not set"
    delete process.env.DATABASE_ENGINE;
    vi.stubEnv('DUCKDB_PATH', '/tmp/test-default.db');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('defaults to duckdb and opens a DuckDB connection', async () => {
    const { DuckDBInstance } = await import('@duckdb/node-api');
    await createDrizzleClient();
    expect(DuckDBInstance.create).toHaveBeenCalled();
  });

  it('defaults to duckdb and does NOT create a pg.Pool', async () => {
    await createDrizzleClient();
    expect(Pool).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC: DATABASE_ENGINE=postgres
// ---------------------------------------------------------------------------

describe('Slice 3 AC: createDrizzleClient() with DATABASE_ENGINE=postgres', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_ENGINE', 'postgres');
    vi.stubEnv('DATABASE_URL', 'postgres://user:pass@localhost:5432/testdb');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('returns a Drizzle client without throwing', async () => {
    await expect(createDrizzleClient()).resolves.not.toThrow();
  });

  it('creates a pg.Pool using DATABASE_URL', async () => {
    await createDrizzleClient();
    expect(Pool).toHaveBeenCalledWith({
      connectionString: 'postgres://user:pass@localhost:5432/testdb',
    });
  });

  it('uses drizzle-orm/node-postgres (pg driver) to create the client', async () => {
    await createDrizzleClient();
    expect(drizzlePg).toHaveBeenCalled();
  });

  it('does NOT open a DuckDB instance', async () => {
    const { DuckDBInstance } = await import('@duckdb/node-api');
    await createDrizzleClient();
    expect(DuckDBInstance.create).not.toHaveBeenCalled();
  });

  it('does NOT call fs.mkdirSync (no directory creation for Postgres)', async () => {
    await createDrizzleClient();
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });

  it('does NOT call drizzle-orm/pg-proxy drizzle (DuckDB adapter)', async () => {
    await createDrizzleClient();
    expect(drizzleProxy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC: DUCKDB_PATH default when env var is absent
// ---------------------------------------------------------------------------

describe('Slice 3 AC: DUCKDB_PATH defaults to ./data/genbi.db when unset', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_ENGINE', 'duckdb');
    delete process.env.DUCKDB_PATH;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('opens DuckDB at ./data/genbi.db when DUCKDB_PATH is not set', async () => {
    const { DuckDBInstance } = await import('@duckdb/node-api');
    await createDrizzleClient();
    expect(DuckDBInstance.create).toHaveBeenCalledWith('./data/genbi.db');
  });
});

// ---------------------------------------------------------------------------
// AC: interpolateParams / formatParam — tested via the DuckDB remote callback
// ---------------------------------------------------------------------------

describe('Slice 3 AC: DuckDB remote callback SQL interpolation', () => {
  let capturedCallback: ((sql: string, params: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>) | undefined;
  let mockRunAndReadAll: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.stubEnv('DATABASE_ENGINE', 'duckdb');
    vi.stubEnv('DUCKDB_PATH', '/tmp/test-interpolate.db');

    const { DuckDBInstance } = await import('@duckdb/node-api');
    mockRunAndReadAll = vi.fn().mockResolvedValue({ getRowObjects: () => [] });
    const mockConnection = { run: vi.fn().mockResolvedValue(undefined), runAndReadAll: mockRunAndReadAll };
    const mockInstance = { connect: vi.fn().mockResolvedValue(mockConnection) };
    (DuckDBInstance.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockInstance);

    await createDrizzleClient();

    capturedCallback = (drizzleProxy as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('passes SQL unchanged when params array is empty', async () => {
    await capturedCallback!('SELECT 1', []);
    expect(mockRunAndReadAll).toHaveBeenCalledWith('SELECT 1');
  });

  it('interpolates a single string param into the SQL placeholder', async () => {
    await capturedCallback!('SELECT * FROM t WHERE name = $1', ['alice']);
    expect(mockRunAndReadAll).toHaveBeenCalledWith("SELECT * FROM t WHERE name = 'alice'");
  });

  it('escapes single quotes inside a string param', async () => {
    await capturedCallback!('SELECT * FROM t WHERE name = $1', ["o'brien"]);
    expect(mockRunAndReadAll).toHaveBeenCalledWith("SELECT * FROM t WHERE name = 'o''brien'");
  });

  it('interpolates a numeric param without surrounding quotes', async () => {
    await capturedCallback!('SELECT * FROM t WHERE id = $1', [42]);
    expect(mockRunAndReadAll).toHaveBeenCalledWith('SELECT * FROM t WHERE id = 42');
  });

  it('interpolates a boolean param without surrounding quotes', async () => {
    await capturedCallback!('SELECT * FROM t WHERE active = $1', [true]);
    expect(mockRunAndReadAll).toHaveBeenCalledWith('SELECT * FROM t WHERE active = true');
  });

  it('interpolates null as NULL', async () => {
    await capturedCallback!('SELECT * FROM t WHERE deleted_at = $1', [null]);
    expect(mockRunAndReadAll).toHaveBeenCalledWith('SELECT * FROM t WHERE deleted_at = NULL');
  });

  it('interpolates undefined as NULL', async () => {
    await capturedCallback!('SELECT * FROM t WHERE deleted_at = $1', [undefined]);
    expect(mockRunAndReadAll).toHaveBeenCalledWith('SELECT * FROM t WHERE deleted_at = NULL');
  });

  it('interpolates a Date param as a quoted ISO 8601 timestamp', async () => {
    const date = new Date('2024-06-15T12:00:00.000Z');
    await capturedCallback!('SELECT * FROM t WHERE created_at = $1', [date]);
    expect(mockRunAndReadAll).toHaveBeenCalledWith("SELECT * FROM t WHERE created_at = '2024-06-15T12:00:00.000Z'");
  });

  it('interpolates an array param as a JSON string', async () => {
    await capturedCallback!('SELECT * FROM t WHERE tags = $1', [['a', 'b']]);
    expect(mockRunAndReadAll).toHaveBeenCalledWith('SELECT * FROM t WHERE tags = \'["a","b"]\'');
  });

  it('interpolates multiple params in positional order', async () => {
    await capturedCallback!('SELECT * FROM t WHERE a = $1 AND b = $2', ['foo', 99]);
    expect(mockRunAndReadAll).toHaveBeenCalledWith("SELECT * FROM t WHERE a = 'foo' AND b = 99");
  });

  it('returns the rows from runAndReadAll wrapped in { rows }', async () => {
    mockRunAndReadAll.mockResolvedValue({ getRowObjects: () => [{ id: 1 }] });
    const result = await capturedCallback!('SELECT id FROM t', []);
    expect(result).toEqual({ rows: [{ id: 1 }] });
  });
});
