import type { RelevantColumn } from './schema-retrieval.port';

export function buildSchemaContext(columns: RelevantColumn[]): string {
  if (columns.length === 0) return '';

  const grouped = new Map<string, RelevantColumn[]>();
  for (const col of columns) {
    const existing = grouped.get(col.tableName) ?? [];
    existing.push(col);
    grouped.set(col.tableName, existing);
  }

  const lines: string[] = [];
  for (const [tableName, cols] of grouped) {
    lines.push(`Table: ${tableName}`);
    for (const col of cols) {
      let line = `  - ${col.columnName} (${col.dataType})`;
      if (col.foreignKey) {
        line += ` → FK: ${col.foreignKey.table}.${col.foreignKey.column}`;
      }
      lines.push(line);
    }
  }

  return lines.join('\n');
}
