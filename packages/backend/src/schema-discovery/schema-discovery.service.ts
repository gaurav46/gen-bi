import { Inject, Injectable } from '@nestjs/common';
import { ConnectionsService, PRISMA_CLIENT } from '../connections/connections.service';
import type { TenantDatabasePort } from './tenant-database.port';

export const TENANT_DATABASE_PORT = 'TENANT_DATABASE_PORT';
const SYSTEM_SCHEMA_NAMES = new Set(['information_schema', 'pg_catalog', 'pg_toast']);

@Injectable()
export class SchemaDiscoveryService {
  private progress = { status: 'idle' as string, current: 0, total: 0, message: '' };

  constructor(
    private readonly connectionsService: ConnectionsService,
    @Inject(TENANT_DATABASE_PORT) private readonly tenantDatabasePort: TenantDatabasePort,
    @Inject(PRISMA_CLIENT) private readonly prisma: any,
  ) {}

  getDiscoveryStatus() {
    return this.progress;
  }

  async getDiscoveredTables(connectionId: string) {
    return this.prisma.discoveredTable.findMany({
      where: { connectionId },
      include: { columns: true, foreignKeys: true, indexes: true },
    });
  }

  async analyzeSchemas(connectionId: string, schemas: string[]) {
    if (this.progress.status === 'analyzing') {
      throw new Error('Analysis already in progress');
    }

    this.progress = { status: 'analyzing', current: 0, total: 0, message: 'Starting analysis...' };

    const config = await this.connectionsService.findOne(connectionId);

    try {
      await this.tenantDatabasePort.connect({
        host: config.host,
        port: config.port,
        database: config.databaseName,
        username: config.username,
        password: config.password,
      });

      const placeholders = schemas.map((_, i) => `$${i + 1}`).join(', ');

      const tablesResult = await this.tenantDatabasePort.query(
        `SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN (${placeholders}) AND table_type = 'BASE TABLE' ORDER BY table_schema, table_name`,
        schemas,
      );

      if (tablesResult.rows.length === 0) {
        throw new Error('No tables found in selected schemas');
      }

      this.progress = { status: 'analyzing', current: 0, total: tablesResult.rows.length, message: '' };

      const columnsResult = await this.tenantDatabasePort.query(
        `SELECT table_schema, table_name, column_name, data_type, is_nullable, ordinal_position FROM information_schema.columns WHERE table_schema IN (${placeholders}) ORDER BY table_schema, table_name, ordinal_position`,
        schemas,
      );

      const fkResult = await this.tenantDatabasePort.query(
        `SELECT tc.table_schema, tc.table_name, kcu.column_name, ccu.table_schema AS foreign_table_schema, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name, tc.constraint_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema IN (${placeholders})`,
        schemas,
      );

      const indexResult = await this.tenantDatabasePort.query(
        `SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes WHERE schemaname IN (${placeholders})`,
        schemas,
      );

      await this.prisma.discoveredTable.deleteMany({ where: { connectionId } });

      let current = 0;
      for (const tableRow of tablesResult.rows) {
        current++;
        this.progress = {
          status: 'analyzing',
          current,
          total: tablesResult.rows.length,
          message: `Analyzing table ${current} of ${tablesResult.rows.length}`,
        };

        const tableSchema = tableRow.table_schema as string;
        const tableName = tableRow.table_name as string;

        const tableColumns = columnsResult.rows.filter(
          (c) => c.table_schema === tableSchema && c.table_name === tableName,
        );

        const tableFks = fkResult.rows.filter(
          (fk) => fk.table_schema === tableSchema && fk.table_name === tableName,
        );

        const tableIndexes = indexResult.rows.filter(
          (idx) => idx.schemaname === tableSchema && idx.tablename === tableName,
        );

        await this.prisma.discoveredTable.create({
          data: {
            connectionId,
            schemaName: tableSchema,
            tableName,
            columns: {
              create: tableColumns.map((c) => ({
                columnName: c.column_name as string,
                dataType: c.data_type as string,
                isNullable: c.is_nullable === 'YES',
                ordinalPosition: Number(c.ordinal_position),
              })),
            },
            foreignKeys: {
              create: tableFks.map((fk) => ({
                columnName: fk.column_name as string,
                foreignTableSchema: fk.foreign_table_schema as string,
                foreignTableName: fk.foreign_table_name as string,
                foreignColumnName: fk.foreign_column_name as string,
                constraintName: fk.constraint_name as string,
              })),
            },
            indexes: {
              create: tableIndexes.map((idx) => ({
                indexName: idx.indexname as string,
                columnName: idx.tablename as string,
                isUnique: (idx.indexdef as string)?.includes('UNIQUE') ?? false,
              })),
            },
          },
        });
      }

      this.progress = { status: 'done', current, total: tablesResult.rows.length, message: 'Analysis complete' };
      return { tablesDiscovered: tablesResult.rows.length };
    } catch (error) {
      this.progress = { status: 'error', current: 0, total: 0, message: String(error) };
      throw error;
    } finally {
      await this.tenantDatabasePort.disconnect();
    }
  }

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
