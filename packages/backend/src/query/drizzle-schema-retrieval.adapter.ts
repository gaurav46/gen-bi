import { Injectable, Inject } from '@nestjs/common';
import { eq, sql, count } from 'drizzle-orm';
import { DRIZZLE_CLIENT, type AppDatabase } from '../infrastructure/drizzle/client';
import * as tables from '../infrastructure/drizzle/schema';
import type { SchemaRetrievalPort, RelevantColumn } from './schema-retrieval.port';

type RawColumnRow = {
  table_name: string;
  schema_name: string;
  column_name: string;
  data_type: string;
};

@Injectable()
export class DrizzleSchemaRetrievalAdapter implements SchemaRetrievalPort {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: AppDatabase) {}

  async findRelevantColumns(
    connectionId: string,
    questionEmbedding: number[],
    topK: number,
  ): Promise<RelevantColumn[]> {
    const engine = process.env.DATABASE_ENGINE ?? 'duckdb';
    const orderBySql = buildVectorOrderBy(tables.columnEmbeddings, questionEmbedding, engine);

    const rows = await this.db
      .select({
        table_name: tables.discoveredTables.tableName,
        schema_name: tables.discoveredTables.schemaName,
        column_name: tables.discoveredColumns.columnName,
        data_type: tables.discoveredColumns.dataType,
      })
      .from(tables.columnEmbeddings)
      .innerJoin(
        tables.discoveredTables,
        eq(tables.columnEmbeddings.tableId, tables.discoveredTables.id),
      )
      .innerJoin(
        tables.discoveredColumns,
        eq(tables.columnEmbeddings.columnId, tables.discoveredColumns.id),
      )
      .where(eq(tables.columnEmbeddings.connectionId, connectionId))
      .orderBy(orderBySql)
      .limit(topK);

    return rows.map(toRelevantColumn);
  }

  async hasEmbeddings(connectionId: string): Promise<boolean> {
    const [result] = await this.db
      .select({ total: count() })
      .from(tables.columnEmbeddings)
      .where(eq(tables.columnEmbeddings.connectionId, connectionId));

    return (result?.total ?? 0) > 0;
  }
}

function buildVectorOrderBy(
  embeddingTable: typeof tables.columnEmbeddings,
  embedding: number[],
  engine: string,
) {
  if (engine === 'duckdb') {
    return sql`array_cosine_similarity(${embeddingTable.embedding}, ${embedding}::FLOAT[1536]) DESC`;
  }

  const vectorStr = `[${embedding.join(',')}]`;
  return sql`${embeddingTable.embedding} <=> '${sql.raw(vectorStr)}'::vector`;
}

function toRelevantColumn(row: RawColumnRow): RelevantColumn {
  return {
    tableName: row.table_name,
    columnName: row.column_name,
    dataType: row.data_type,
  };
}
