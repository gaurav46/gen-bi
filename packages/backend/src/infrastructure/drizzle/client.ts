import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { drizzle as drizzlePg, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzleProxy, type RemoteCallback } from 'drizzle-orm/pg-proxy';
import * as schema from './schema';

export const DRIZZLE_CLIENT = 'DRIZZLE_CLIENT' as const;

export type AppDatabase = NodePgDatabase<typeof schema>;

function ensureDirectoryExists(dbPath: string): void {
  fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
}

function duckDbRemoteCallback(connection: {
  runAndReadAll: (sql: string) => Promise<{ getRowObjects: () => Record<string, unknown>[] }>;
}): RemoteCallback {
  return async (sql, params) => {
    const resolvedSql = interpolateParams(sql, params);
    const reader = await connection.runAndReadAll(resolvedSql);
    const rows = reader.getRowObjects();
    return { rows };
  };
}

function interpolateParams(sql: string, params: unknown[]): string {
  if (params.length === 0) return sql;
  return sql.replace(/\$(\d+)/g, (_match, index) => {
    return formatParam(params[Number(index) - 1]);
  });
}

function formatParam(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (Array.isArray(value)) return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function createDuckDbClient(dbPath: string): Promise<AppDatabase> {
  const { DuckDBInstance } = await import('@duckdb/node-api');

  ensureDirectoryExists(dbPath);

  const instance = await DuckDBInstance.create(dbPath);
  const connection = await instance.connect();

  await connection.run('LOAD vss');
  await connection.run('SET hnsw_enable_experimental_persistence = true');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // DuckDB connection is structurally compatible with the pg-proxy callback shape but
  // TypeScript cannot verify this statically — the cast is intentional and load-bearing.
  return drizzleProxy(duckDbRemoteCallback(connection as any), { schema }) as unknown as AppDatabase;
}

async function createPostgresClient(): Promise<AppDatabase> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return drizzlePg(pool, { schema });
}

export async function createDrizzleClient(): Promise<AppDatabase> {
  const engine = process.env.DATABASE_ENGINE ?? 'duckdb';

  if (engine === 'duckdb') {
    const dbPath = process.env.DUCKDB_PATH ?? './data/genbi.db';
    return createDuckDbClient(dbPath);
  }

  return createPostgresClient();
}
