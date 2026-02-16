import type { RelevantColumn } from './schema-retrieval.port';
import type { SampleRows } from './query.types';

export function buildSchemaContext(columns: RelevantColumn[], sampleRows: SampleRows = new Map()): string {
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

    const rows = sampleRows.get(tableName);
    if (rows && rows.length > 0) {
      lines.push(`  Sample rows:`);
      for (const row of rows) {
        const values = Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(', ');
        lines.push(`    ${values}`);
      }
    }
  }

  return lines.join('\n');
}
