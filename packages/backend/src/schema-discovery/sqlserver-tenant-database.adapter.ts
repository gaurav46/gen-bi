import { Injectable, Logger } from '@nestjs/common';
import type { QueryResult, TenantConnectionConfig, TenantDatabasePort } from './tenant-database.port';

@Injectable()
export class SqlServerTenantDatabaseAdapter implements TenantDatabasePort {
  readonly systemSchemaNames: ReadonlySet<string> = new Set([
    'sys',
    'INFORMATION_SCHEMA',
    'db_owner',
    'db_accessadmin',
    'db_securityadmin',
    'db_backupoperator',
    'db_datareader',
    'db_datawriter',
    'db_ddladmin',
  ]);

  private readonly logger = new Logger(SqlServerTenantDatabaseAdapter.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pool: any | null = null;

  async connect(config: TenantConnectionConfig): Promise<void> {
    this.logger.log(`Connecting to ${config.dbType} tenant database at ${config.host}:${config.port}/${config.database}`);

    const encrypt = config.encrypt ?? false;

    try {
      const { ConnectionPool } = await import('mssql');
      const newPool = new ConnectionPool({
        server: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        options: {
          encrypt,
          trustServerCertificate: !encrypt,
        },
      });
      await newPool.connect();
      this.pool = newPool;
    } catch (error) {
      const message =
        typeof error === 'object' && error !== null
          ? ((error as { message?: string }).message ?? 'Unknown connection error')
          : 'Unknown connection error';
      const originalError = error as { code?: string; number?: number };

      // SQL Server login failure: error number 18456 or message contains "Login failed"
      if (
        originalError.number === 18456 ||
        message.toLowerCase().includes('login failed')
      ) {
        throw new Error('Invalid credentials for tenant database');
      }

      // Network-level failure
      if (
        originalError.code === 'ECONNREFUSED' ||
        message.includes('ECONNREFUSED') ||
        message.toLowerCase().includes('failed to connect') ||
        message.toLowerCase().includes('getaddrinfo')
      ) {
        throw new Error('Unable to reach tenant database host');
      }

      throw new Error(`Failed to connect to tenant database: ${message}`);
    }
  }

  async queryIndexes(schemas: string[]): Promise<QueryResult> {
    const placeholders = schemas.map((_, i) => `$${i + 1}`).join(', ');
    return this.query(
      `SELECT s.name AS schemaname, t.name AS tablename, i.name AS indexname, c.name AS columnname, i.is_unique FROM sys.indexes i JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id JOIN sys.tables t ON i.object_id = t.object_id JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE i.type > 0 AND s.name IN (${placeholders})`,
      schemas,
    );
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    if (!this.pool) {
      throw new Error('Tenant database client is not connected');
    }

    const request = this.pool.request();

    let translatedSql = sql;
    if (params && params.length > 0) {
      params.forEach((value, i) => {
        const paramName = `p${i + 1}`;
        // Replace $N with @pN (positional, left-to-right)
        translatedSql = translatedSql.replace(`$${i + 1}`, `@${paramName}`);
        request.input(paramName, value);
      });
    }

    const result = await request.query(translatedSql);
    return { rows: result.recordset as Record<string, unknown>[] };
  }

  async disconnect(): Promise<void> {
    if (!this.pool) return;

    try {
      await this.pool.close();
    } catch {
      // noop: clear local pool state even if mssql reports it is already closed
    } finally {
      this.pool = null;
    }
  }
}
