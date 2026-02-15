export type DiscoveredColumn = {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  ordinalPosition: number;
};

export type DiscoveredForeignKey = {
  columnName: string;
  foreignTableSchema: string;
  foreignTableName: string;
  foreignColumnName: string;
  constraintName: string;
};

export type DiscoveredIndex = {
  indexName: string;
  columnName: string;
  isUnique: boolean;
};

export type DiscoveredTable = {
  id: string;
  connectionId: string;
  schemaName: string;
  tableName: string;
  columns: DiscoveredColumn[];
  foreignKeys: DiscoveredForeignKey[];
  indexes: DiscoveredIndex[];
};

export type ColumnDisplayInfo = {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  ordinalPosition: number;
  foreignKey: { tableName: string; columnName: string } | null;
  indexType: 'PK' | 'UQ' | 'IDX' | null;
};
