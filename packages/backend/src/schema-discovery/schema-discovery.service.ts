import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConnectionsService, PRISMA_CLIENT } from '../connections/connections.service';
import type { TenantDatabasePort } from './tenant-database.port';
import type { EmbeddingPort } from './embedding.port';
import { EMBEDDING_PORT } from './embedding.port';
import type { DescriptionSuggestionPort } from './description-suggestion.port';
import { DESCRIPTION_SUGGESTION_PORT } from './description-suggestion.port';
import { buildEmbeddingInputs } from './embedding-input';
import { isAmbiguousColumnName } from './ambiguity';

export const TENANT_DATABASE_PORT = 'TENANT_DATABASE_PORT';
const SYSTEM_SCHEMA_NAMES = new Set(['information_schema', 'pg_catalog', 'pg_toast']);

@Injectable()
export class SchemaDiscoveryService {
  private readonly logger = new Logger(SchemaDiscoveryService.name);
  private progress = { status: 'idle' as string, current: 0, total: 0, message: '' };

  constructor(
    private readonly connectionsService: ConnectionsService,
    @Inject(TENANT_DATABASE_PORT) private readonly tenantDatabasePort: TenantDatabasePort,
    @Inject(PRISMA_CLIENT) private readonly prisma: any,
    @Inject(EMBEDDING_PORT) private readonly embeddingPort: EmbeddingPort,
    @Optional() @Inject(DESCRIPTION_SUGGESTION_PORT) private readonly descriptionPort?: DescriptionSuggestionPort,
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
    this.logger.log(`Starting schema analysis for connection ${connectionId}, schemas: ${schemas.join(', ')}`);

    const config = await this.connectionsService.getTenantConnectionConfig(connectionId);

    try {
      await this.tenantDatabasePort.connect(config);

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
        `SELECT n.nspname AS schemaname, t.relname AS tablename, i.relname AS indexname, a.attname AS columnname, ix.indisunique AS is_unique FROM pg_index ix JOIN pg_class t ON t.oid = ix.indrelid JOIN pg_class i ON i.oid = ix.indexrelid JOIN pg_namespace n ON n.oid = t.relnamespace JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey) WHERE n.nspname IN (${placeholders})`,
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
                columnName: idx.columnname as string,
                isUnique: Boolean(idx.is_unique),
              })),
            },
          },
        });
      }

      this.progress = { status: 'introspected', current, total: tablesResult.rows.length, message: 'Introspection complete' };
      this.logger.log(`Schema analysis complete for connection ${connectionId}: ${tablesResult.rows.length} tables discovered`);
      return { tablesDiscovered: tablesResult.rows.length };
    } catch (error) {
      this.logger.error(`Schema analysis failed for connection ${connectionId}: ${error}`);
      this.progress = { status: 'error', current: 0, total: 0, message: String(error) };
      throw error;
    } finally {
      await this.tenantDatabasePort.disconnect();
    }
  }

  async getAnnotations(connectionId: string) {
    const tables = await this.prisma.discoveredTable.findMany({
      where: { connectionId },
      include: { columns: true },
    });

    const ambiguousColumns: {
      columnId: string;
      tableName: string;
      schemaName: string;
      columnName: string;
      dataType: string;
      neighborColumns: string[];
    }[] = [];

    for (const table of tables) {
      const allColumnNames = table.columns.map((c: any) => c.columnName as string);
      for (const col of table.columns) {
        if (isAmbiguousColumnName(col.columnName)) {
          ambiguousColumns.push({
            columnId: col.id,
            tableName: table.tableName,
            schemaName: table.schemaName,
            columnName: col.columnName,
            dataType: col.dataType,
            neighborColumns: allColumnNames.filter((n: string) => n !== col.columnName),
          });
        }
      }
    }

    let suggestions: Map<string, string> = new Map();
    if (ambiguousColumns.length > 0 && this.descriptionPort) {
      try {
        const results = await this.descriptionPort.suggestDescriptions(
          ambiguousColumns.map((c) => ({
            tableName: c.tableName,
            columnName: c.columnName,
            dataType: c.dataType,
            neighborColumns: c.neighborColumns,
          })),
        );
        for (const r of results) {
          suggestions.set(`${r.tableName}.${r.columnName}`, r.description);
        }
      } catch {
        this.logger.warn('AI description suggestion failed, returning null suggestions');
      }
    }

    return {
      columns: ambiguousColumns.map((c) => ({
        columnId: c.columnId,
        tableName: c.tableName,
        schemaName: c.schemaName,
        columnName: c.columnName,
        dataType: c.dataType,
        suggestedDescription: suggestions.get(`${c.tableName}.${c.columnName}`) ?? null,
      })),
    };
  }

  async embedColumns(connectionId: string) {
    if (this.progress.status === 'analyzing') {
      throw new Error('Embedding already in progress');
    }

    this.progress = { status: 'analyzing', current: 0, total: 0, message: 'Generating embeddings...' };

    try {
      const tables = await this.prisma.discoveredTable.findMany({
        where: { connectionId },
        include: { columns: true },
      });

      const allColumns = tables.flatMap((table: any) =>
        table.columns.map((col: any) => ({
          tableId: table.id,
          columnId: col.id,
          tableName: table.tableName,
          columnName: col.columnName,
          dataType: col.dataType,
          description: col.description ?? undefined,
        })),
      );

      const inputs = buildEmbeddingInputs(allColumns);
      const embeddings = await this.embeddingPort.generateEmbeddings(inputs);

      await this.prisma.$executeRaw`DELETE FROM column_embeddings WHERE connection_id = ${connectionId}`;
      for (let i = 0; i < inputs.length; i++) {
        const vector = `[${embeddings[i].join(',')}]`;
        await this.prisma.$executeRaw`INSERT INTO column_embeddings (id, connection_id, table_id, column_id, input_text, embedding, created_at) VALUES (gen_random_uuid(), ${connectionId}, ${allColumns[i].tableId}, ${allColumns[i].columnId}, ${inputs[i]}, ${vector}::vector, now())`;
      }

      this.progress = { status: 'done', current: allColumns.length, total: allColumns.length, message: 'Analysis complete' };
    } catch (error) {
      this.logger.error(`Embedding failed for connection ${connectionId}: ${error}`);
      this.progress = { status: 'error', current: 0, total: 0, message: String(error) };
      throw error;
    }
  }

  async saveAnnotations(connectionId: string, annotations: { columnId: string; description: string }[]) {
    for (const annotation of annotations) {
      await this.prisma.discoveredColumn.update({
        where: { id: annotation.columnId },
        data: { description: annotation.description },
      });
    }
    return { updated: annotations.length };
  }

  async testConnection(connectionId: string) {
    const config = await this.connectionsService.getTenantConnectionConfig(connectionId);

    try {
      await this.tenantDatabasePort.connect(config);

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
