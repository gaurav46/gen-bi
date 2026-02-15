import { Injectable, Inject } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import type { SchemaRetrievalPort, RelevantColumn } from './schema-retrieval.port';

type RawColumnRow = {
  table_name: string;
  column_name: string;
  data_type: string;
  fk_table: string | null;
  fk_column: string | null;
};

@Injectable()
export class PrismaSchemaRetrievalAdapter implements SchemaRetrievalPort {
  constructor(@Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient) {}

  async findRelevantColumns(
    connectionId: string,
    questionEmbedding: number[],
    topK: number,
  ): Promise<RelevantColumn[]> {
    const vectorStr = `[${questionEmbedding.join(',')}]`;

    const rows = await this.prisma.$queryRaw<RawColumnRow[]>`
      SELECT
        dt.table_name,
        dc.column_name,
        dc.data_type,
        dfk.foreign_table_name AS fk_table,
        dfk.foreign_column_name AS fk_column
      FROM column_embeddings ce
      JOIN discovered_tables dt
        ON dt.table_name = ce.table_id AND dt.connection_id = ce.connection_id
      JOIN discovered_columns dc
        ON dc.table_id = dt.id AND dc.column_name = ce.column_id
      LEFT JOIN discovered_foreign_keys dfk
        ON dfk.table_id = dt.id AND dfk.column_name = dc.column_name
      WHERE ce.connection_id = ${connectionId}
      ORDER BY ce.embedding <=> ${vectorStr}::vector
      LIMIT ${topK}
    `;

    return rows.map((row) => ({
      tableName: row.table_name,
      columnName: row.column_name,
      dataType: row.data_type,
      ...(row.fk_table && row.fk_column
        ? { foreignKey: { table: row.fk_table, column: row.fk_column } }
        : {}),
    }));
  }

  async hasEmbeddings(connectionId: string): Promise<boolean> {
    const count = await this.prisma.columnEmbedding.count({
      where: { connectionId },
    });
    return count > 0;
  }
}
