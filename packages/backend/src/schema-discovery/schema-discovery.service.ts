import { Inject, Injectable } from '@nestjs/common';
import { ConnectionsService } from '../connections/connections.service';
import type { TenantDatabasePort } from './tenant-database.port';

export const TENANT_DATABASE_PORT = 'TENANT_DATABASE_PORT';
const SYSTEM_SCHEMA_NAMES = new Set(['information_schema', 'pg_catalog', 'pg_toast']);

@Injectable()
export class SchemaDiscoveryService {
  constructor(
    private readonly connectionsService: ConnectionsService,
    @Inject(TENANT_DATABASE_PORT) private readonly tenantDatabasePort: TenantDatabasePort
  ) {}

  async testConnection(connectionId: string) {
    const config = await this.connectionsService.findOne(connectionId);

    try {
      await this.tenantDatabasePort.connect({
        host: config.host,
        port: config.port,
        database: config.databaseName,
        username: config.username,
        password: config.password,
      });

      const result = await this.tenantDatabasePort.query(
        'SELECT schema_name FROM information_schema.schemata ORDER BY schema_name ASC'
      );

      const schemas = result.rows
        .map((row) => row.schema_name)
        .filter((schemaName): schemaName is string => typeof schemaName === 'string')
        .filter((schemaName) => !SYSTEM_SCHEMA_NAMES.has(schemaName))
        .filter((schemaName) => !schemaName.startsWith('pg_temp_'))
        .filter((schemaName) => !schemaName.startsWith('pg_toast_temp_'));

      if (schemas.length === 0) {
        throw new Error('No non-system schemas found');
      }

      return { schemas };
    } finally {
      await this.tenantDatabasePort.disconnect();
    }
  }
}
