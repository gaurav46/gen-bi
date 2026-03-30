import { Injectable } from '@nestjs/common';
import type { QueryResult, TenantConnectionConfig, TenantDatabasePort } from './tenant-database.port';
import { TenantDatabaseAdapter } from './tenant-database.adapter';
import { SqlServerTenantDatabaseAdapter } from './sqlserver-tenant-database.adapter';

@Injectable()
export class TenantDatabaseDispatcher implements TenantDatabasePort {
  private active: TenantDatabasePort | null = null;

  constructor(
    private readonly postgresAdapter: TenantDatabaseAdapter,
    private readonly sqlServerAdapter: SqlServerTenantDatabaseAdapter,
  ) {}

  get systemSchemaNames(): ReadonlySet<string> {
    return this.active?.systemSchemaNames ?? new Set();
  }

  async connect(config: TenantConnectionConfig): Promise<void> {
    this.active = config.dbType === 'sqlserver'
      ? this.sqlServerAdapter
      : this.postgresAdapter;
    await this.active.connect(config);
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    if (!this.active) {
      throw new Error('Tenant database client is not connected');
    }
    return this.active.query(sql, params);
  }

  async queryIndexes(schemas: string[]): Promise<QueryResult> {
    if (!this.active) {
      throw new Error('Tenant database client is not connected');
    }
    return this.active.queryIndexes(schemas);
  }

  async disconnect(): Promise<void> {
    await this.active?.disconnect();
    this.active = null;
  }
}
