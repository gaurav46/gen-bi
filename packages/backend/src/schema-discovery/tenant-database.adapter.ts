import { Injectable } from '@nestjs/common';
import { Client } from 'pg';
import type { QueryResult, TenantConnectionConfig, TenantDatabasePort } from './tenant-database.port';

@Injectable()
export class TenantDatabaseAdapter implements TenantDatabasePort {
  private client: Client | null = null;

  async connect(config: TenantConnectionConfig): Promise<void> {
    this.client = new Client({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
    });

    try {
      await this.client.connect();
      await this.client.query('SET default_transaction_read_only = on');
    } catch (error) {
      const code = typeof error === 'object' && error !== null ? (error as { code?: string }).code : undefined;
      const message = typeof error === 'object' && error !== null ? (error as { message?: string }).message : undefined;

      if (code === '28P01') {
        throw new Error('Invalid credentials for tenant database');
      }

      if (code === 'ECONNREFUSED') {
        throw new Error('Unable to reach tenant database host');
      }

      throw new Error(`Failed to connect to tenant database: ${message ?? 'Unknown connection error'}`);
    }
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    if (!this.client) {
      throw new Error('Tenant database client is not connected');
    }

    const result = params ? await this.client.query(sql, params) : await this.client.query(sql);
    return { rows: result.rows as Record<string, unknown>[] };
  }

  async disconnect(): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.end();
    } catch {
      // noop: we still clear local client state even if pg reports it is already closed
    } finally {
      this.client = null;
    }
  }
}
