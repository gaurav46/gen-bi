import type {
  DiscoveredColumn,
  DiscoveredForeignKey,
  DiscoveredIndex,
  DiscoveredTable,
  ColumnDisplayInfo,
} from './schema-types';

export function enrichColumnsForDisplay(
  columns: DiscoveredColumn[],
  foreignKeys: DiscoveredForeignKey[],
  indexes: DiscoveredIndex[],
): ColumnDisplayInfo[] {
  return columns.map((col) => {
    const fk = foreignKeys.find((f) => f.columnName === col.columnName);
    const idx = indexes.find((i) => i.columnName === col.columnName);

    let indexType: ColumnDisplayInfo['indexType'] = null;
    if (idx) {
      indexType = idx.indexName.endsWith('_pkey') ? 'PK' : idx.isUnique ? 'UQ' : 'IDX';
    }

    return {
      columnName: col.columnName,
      dataType: col.dataType,
      isNullable: col.isNullable,
      ordinalPosition: col.ordinalPosition,
      foreignKey: fk ? { tableName: fk.foreignTableName, columnName: fk.foreignColumnName } : null,
      indexType,
    };
  });
}

export function groupTablesBySchema(tables: DiscoveredTable[]): Map<string, DiscoveredTable[]> {
  const grouped = new Map<string, DiscoveredTable[]>();
  for (const table of tables) {
    const existing = grouped.get(table.schemaName) ?? [];
    existing.push(table);
    grouped.set(table.schemaName, existing);
  }
  return grouped;
}

export function filterTablesByName(tables: DiscoveredTable[], search: string): DiscoveredTable[] {
  const term = search.trim().toLowerCase();
  if (!term) return tables;
  return tables.filter((t) => t.tableName.toLowerCase().includes(term));
}
