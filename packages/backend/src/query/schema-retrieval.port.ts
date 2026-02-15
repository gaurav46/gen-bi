export type RelevantColumn = {
  tableName: string;
  columnName: string;
  dataType: string;
  foreignKey?: { table: string; column: string };
};

export interface SchemaRetrievalPort {
  findRelevantColumns(
    connectionId: string,
    questionEmbedding: number[],
    topK: number,
  ): Promise<RelevantColumn[]>;

  hasEmbeddings(connectionId: string): Promise<boolean>;
}

export const SCHEMA_RETRIEVAL_PORT = 'SCHEMA_RETRIEVAL_PORT';
