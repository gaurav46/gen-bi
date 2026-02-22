export type ColumnMetadata = {
  tableName: string;
  columnName: string;
  dataType: string;
  description?: string;
};

export function buildEmbeddingInput(column: ColumnMetadata): string {
  const base = `${column.tableName}.${column.columnName} ${column.dataType}`;
  return column.description ? `${base} -- ${column.description}` : base;
}

export function buildEmbeddingInputs(columns: ColumnMetadata[]): string[] {
  return columns.map(buildEmbeddingInput);
}
