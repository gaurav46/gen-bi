export function calculateOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

export function buildRowsQuery(schemaName: string, tableName: string): string {
  return `SELECT * FROM "${schemaName}"."${tableName}" LIMIT $1 OFFSET $2`;
}

export function buildCountQuery(schemaName: string, tableName: string): string {
  return `SELECT count(*) FROM "${schemaName}"."${tableName}"`;
}

export function buildPrimaryKeyQuery(): string {
  return `SELECT kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = $1 AND tc.table_name = $2 ORDER BY kcu.ordinal_position`;
}
