type ColumnMetadata = {
  tableName: string;
  columnName: string;
  dataType: string;
};

export function buildEmbeddingInput(column: ColumnMetadata): string {
  return `${column.tableName}.${column.columnName} ${column.dataType}`;
}

export function buildEmbeddingInputs(columns: ColumnMetadata[]): string[] {
  return columns.map(buildEmbeddingInput);
}
