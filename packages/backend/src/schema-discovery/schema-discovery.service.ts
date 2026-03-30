import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { ConnectionsService } from '../connections/connections.service';
import type { TenantDatabasePort } from './tenant-database.port';
import type { EmbeddingPort } from './embedding.port';
import { EMBEDDING_PORT } from './embedding.port';
import type { DescriptionSuggestionPort } from './description-suggestion.port';
import { DESCRIPTION_SUGGESTION_PORT } from './description-suggestion.port';
import { buildEmbeddingInputs } from './embedding-input';
import { isAmbiguousColumnName } from './ambiguity';
import { DRIZZLE_CLIENT, type AppDatabase } from '../infrastructure/drizzle/client';
import * as tables from '../infrastructure/drizzle/schema';

export const TENANT_DATABASE_PORT = 'TENANT_DATABASE_PORT';

@Injectable()
export class SchemaDiscoveryService {
  private readonly logger = new Logger(SchemaDiscoveryService.name);
  private progress = { status: 'idle' as string, current: 0, total: 0, message: '' };

  constructor(
    private readonly connectionsService: ConnectionsService,
    @Inject(TENANT_DATABASE_PORT) private readonly tenantDatabasePort: TenantDatabasePort,
    @Inject(DRIZZLE_CLIENT) private readonly db: AppDatabase,
    @Inject(EMBEDDING_PORT) private readonly embeddingPort: EmbeddingPort,
    @Optional() @Inject(DESCRIPTION_SUGGESTION_PORT) private readonly descriptionPort?: DescriptionSuggestionPort,
  ) {}

  getDiscoveryStatus() {
    return this.progress;
  }

  async getDiscoveredTables(connectionId: string) {
    const discoveredTableRows = await this.db
      .select()
      .from(tables.discoveredTables)
      .where(eq(tables.discoveredTables.connectionId, connectionId));

    return Promise.all(discoveredTableRows.map((table) => this.loadTableWithRelations(table)));
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

      const indexResult = await this.tenantDatabasePort.queryIndexes(schemas);

      await this.db
        .delete(tables.discoveredTables)
        .where(eq(tables.discoveredTables.connectionId, connectionId));

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

        const tableId = crypto.randomUUID();
        const now = new Date();

        await this.db.insert(tables.discoveredTables).values({
          id: tableId,
          connectionId,
          schemaName: tableSchema,
          tableName,
        });

        const tableColumns = columnsResult.rows.filter(
          (c) => c.table_schema === tableSchema && c.table_name === tableName,
        );

        const tableFks = fkResult.rows.filter(
          (fk) => fk.table_schema === tableSchema && fk.table_name === tableName,
        );

        const tableIndexes = indexResult.rows.filter(
          (idx) => idx.schemaname === tableSchema && idx.tablename === tableName,
        );

        if (tableColumns.length > 0) {
          await this.db.insert(tables.discoveredColumns).values(
            tableColumns.map((c) => ({
              id: crypto.randomUUID(),
              tableId,
              columnName: c.column_name as string,
              dataType: c.data_type as string,
              isNullable: c.is_nullable === 'YES',
              ordinalPosition: Number(c.ordinal_position),
              updatedAt: now,
            })),
          );
        }

        if (tableFks.length > 0) {
          await this.db.insert(tables.discoveredForeignKeys).values(
            tableFks.map((fk) => ({
              id: crypto.randomUUID(),
              tableId,
              columnName: fk.column_name as string,
              foreignTableSchema: fk.foreign_table_schema as string,
              foreignTableName: fk.foreign_table_name as string,
              foreignColumnName: fk.foreign_column_name as string,
              constraintName: fk.constraint_name as string,
              updatedAt: now,
            })),
          );
        }

        if (tableIndexes.length > 0) {
          await this.db.insert(tables.discoveredIndexes).values(
            tableIndexes.map((idx) => ({
              id: crypto.randomUUID(),
              tableId,
              indexName: idx.indexname as string,
              columnName: idx.columnname as string,
              isUnique: Boolean(idx.is_unique),
              updatedAt: now,
            })),
          );
        }
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
    const discoveredTableRows = await this.db
      .select()
      .from(tables.discoveredTables)
      .where(eq(tables.discoveredTables.connectionId, connectionId));

    const tableWithColumns = await Promise.all(
      discoveredTableRows.map(async (table) => {
        const columns = await this.db
          .select()
          .from(tables.discoveredColumns)
          .where(eq(tables.discoveredColumns.tableId, table.id));
        return { ...table, columns };
      }),
    );

    const ambiguousColumns: {
      columnId: string;
      tableName: string;
      schemaName: string;
      columnName: string;
      dataType: string;
      neighborColumns: string[];
    }[] = [];

    for (const table of tableWithColumns) {
      const allColumnNames = table.columns.map((c) => c.columnName);
      for (const col of table.columns) {
        if (isAmbiguousColumnName(col.columnName)) {
          ambiguousColumns.push({
            columnId: col.id,
            tableName: table.tableName,
            schemaName: table.schemaName,
            columnName: col.columnName,
            dataType: col.dataType,
            neighborColumns: allColumnNames.filter((n) => n !== col.columnName),
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
      const discoveredTableRows = await this.db
        .select()
        .from(tables.discoveredTables)
        .where(eq(tables.discoveredTables.connectionId, connectionId));

      const tableWithColumns = await Promise.all(
        discoveredTableRows.map(async (table) => {
          const columns = await this.db
            .select()
            .from(tables.discoveredColumns)
            .where(eq(tables.discoveredColumns.tableId, table.id));
          return { ...table, columns };
        }),
      );

      const allColumns = tableWithColumns.flatMap((table) =>
        table.columns.map((col) => ({
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

      await this.db
        .delete(tables.columnEmbeddings)
        .where(eq(tables.columnEmbeddings.connectionId, connectionId));

      if (inputs.length > 0) {
        await this.db.insert(tables.columnEmbeddings).values(
          inputs.map((inputText, i) => ({
            id: crypto.randomUUID(),
            connectionId,
            tableId: allColumns[i].tableId,
            columnId: allColumns[i].columnId,
            inputText,
            embedding: embeddings[i],
          })),
        );
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
      await this.db
        .update(tables.discoveredColumns)
        .set({ description: annotation.description })
        .where(eq(tables.discoveredColumns.id, annotation.columnId));
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
        .filter((schemaName) => !this.tenantDatabasePort.systemSchemaNames.has(schemaName))
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

  private async loadTableWithRelations(table: typeof tables.discoveredTables.$inferSelect) {
    const [columns, foreignKeys, indexes] = await Promise.all([
      this.db.select().from(tables.discoveredColumns).where(eq(tables.discoveredColumns.tableId, table.id)),
      this.db.select().from(tables.discoveredForeignKeys).where(eq(tables.discoveredForeignKeys.tableId, table.id)),
      this.db.select().from(tables.discoveredIndexes).where(eq(tables.discoveredIndexes.tableId, table.id)),
    ]);
    return { ...table, columns, foreignKeys, indexes };
  }
}
