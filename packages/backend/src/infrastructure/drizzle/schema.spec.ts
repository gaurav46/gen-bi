import { describe, it, expect } from 'vitest';
import { getTableName, getTableColumns } from 'drizzle-orm';
import {
  connectionConfigs,
  discoveredTables,
  discoveredColumns,
  discoveredForeignKeys,
  discoveredIndexes,
  columnEmbeddings,
  dashboards,
  widgets,
} from './schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInlineFKs(table: object): Array<{
  reference: () => { columns: Array<{ name: string }>; foreignColumns: Array<{ name: string }> };
  onDelete: string | undefined;
  onUpdate: string | undefined;
}> {
  const sym = Object.getOwnPropertySymbols(table).find((s) =>
    s.toString().includes('InlineForeignKeys'),
  );
  return sym ? (table as Record<symbol, unknown[]>)[sym] as ReturnType<typeof getInlineFKs> : [];
}

function getExtraConfigItems(
  table: object,
): Array<{ config: { name: string; unique: boolean; columns: Array<{ name: string }> } }> {
  const builderSym = Object.getOwnPropertySymbols(table).find((s) =>
    s.toString().includes('ExtraConfigBuilder'),
  );
  const colsSym = Object.getOwnPropertySymbols(table).find((s) =>
    s.toString().includes('ExtraConfigColumns'),
  );
  if (!builderSym) return [];
  const fn = (table as Record<symbol, unknown>)[builderSym] as (cols: unknown) => unknown[];
  const cols = colsSym ? (table as Record<symbol, unknown>)[colsSym] : {};
  return fn(cols) as ReturnType<typeof getExtraConfigItems>;
}

// ---------------------------------------------------------------------------
// AC 1: All 8 table constants are exported
// ---------------------------------------------------------------------------

describe('Slice 2 AC: all 8 table constants are exported from schema.ts', () => {
  it('exports connectionConfigs', () => {
    expect(connectionConfigs).toBeDefined();
  });

  it('exports discoveredTables', () => {
    expect(discoveredTables).toBeDefined();
  });

  it('exports discoveredColumns', () => {
    expect(discoveredColumns).toBeDefined();
  });

  it('exports discoveredForeignKeys', () => {
    expect(discoveredForeignKeys).toBeDefined();
  });

  it('exports discoveredIndexes', () => {
    expect(discoveredIndexes).toBeDefined();
  });

  it('exports columnEmbeddings', () => {
    expect(columnEmbeddings).toBeDefined();
  });

  it('exports dashboards', () => {
    expect(dashboards).toBeDefined();
  });

  it('exports widgets', () => {
    expect(widgets).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC 2: Each table has the correct Drizzle table name (snake_case)
// ---------------------------------------------------------------------------

describe('Slice 2 AC: each table has the correct snake_case SQL table name', () => {
  it('connectionConfigs has SQL name connection_configs', () => {
    expect(getTableName(connectionConfigs)).toBe('connection_configs');
  });

  it('discoveredTables has SQL name discovered_tables', () => {
    expect(getTableName(discoveredTables)).toBe('discovered_tables');
  });

  it('discoveredColumns has SQL name discovered_columns', () => {
    expect(getTableName(discoveredColumns)).toBe('discovered_columns');
  });

  it('discoveredForeignKeys has SQL name discovered_foreign_keys', () => {
    expect(getTableName(discoveredForeignKeys)).toBe('discovered_foreign_keys');
  });

  it('discoveredIndexes has SQL name discovered_indexes', () => {
    expect(getTableName(discoveredIndexes)).toBe('discovered_indexes');
  });

  it('columnEmbeddings has SQL name column_embeddings', () => {
    expect(getTableName(columnEmbeddings)).toBe('column_embeddings');
  });

  it('dashboards has SQL name dashboards', () => {
    expect(getTableName(dashboards)).toBe('dashboards');
  });

  it('widgets has SQL name widgets', () => {
    expect(getTableName(widgets)).toBe('widgets');
  });
});

// ---------------------------------------------------------------------------
// AC 3: discoveredTables has a unique index on (connectionId, schemaName, tableName)
// ---------------------------------------------------------------------------

describe('Slice 2 AC: discoveredTables has a unique constraint on (connection_id, schema_name, table_name)', () => {
  it('has exactly one extra config item (the unique index)', () => {
    const items = getExtraConfigItems(discoveredTables);
    expect(items).toHaveLength(1);
  });

  it('the unique index is marked as unique', () => {
    const [index] = getExtraConfigItems(discoveredTables);
    expect(index.config.unique).toBe(true);
  });

  it('the unique index covers connection_id, schema_name, and table_name columns', () => {
    const [index] = getExtraConfigItems(discoveredTables);
    const indexedColumns = index.config.columns.map((c) => c.name);
    expect(indexedColumns).toContain('connection_id');
    expect(indexedColumns).toContain('schema_name');
    expect(indexedColumns).toContain('table_name');
    expect(indexedColumns).toHaveLength(3);
  });

  it('the unique index has the expected name', () => {
    const [index] = getExtraConfigItems(discoveredTables);
    expect(index.config.name).toBe('discovered_tables_connection_schema_table_unique');
  });
});

// ---------------------------------------------------------------------------
// AC 4: columnEmbeddings has a unique index on (connectionId, tableId, columnId)
// ---------------------------------------------------------------------------

describe('Slice 2 AC: columnEmbeddings has a unique constraint on (connection_id, table_id, column_id)', () => {
  it('has exactly one extra config item (the unique index)', () => {
    const items = getExtraConfigItems(columnEmbeddings);
    expect(items).toHaveLength(1);
  });

  it('the unique index is marked as unique', () => {
    const [index] = getExtraConfigItems(columnEmbeddings);
    expect(index.config.unique).toBe(true);
  });

  it('the unique index covers connection_id, table_id, and column_id columns', () => {
    const [index] = getExtraConfigItems(columnEmbeddings);
    const indexedColumns = index.config.columns.map((c) => c.name);
    expect(indexedColumns).toContain('connection_id');
    expect(indexedColumns).toContain('table_id');
    expect(indexedColumns).toContain('column_id');
    expect(indexedColumns).toHaveLength(3);
  });

  it('the unique index has the expected name', () => {
    const [index] = getExtraConfigItems(columnEmbeddings);
    expect(index.config.name).toBe('column_embeddings_connection_table_column_unique');
  });
});

// ---------------------------------------------------------------------------
// AC 5: embedding column in columnEmbeddings uses FLOAT[1536] custom type
// ---------------------------------------------------------------------------

describe('Slice 2 AC: columnEmbeddings.embedding is a FLOAT[1536] custom column', () => {
  it('embedding column type is PgCustomColumn', () => {
    const cols = getTableColumns(columnEmbeddings);
    expect(cols.embedding.columnType).toBe('PgCustomColumn');
  });

  it('embedding column getSQLType() returns FLOAT[1536]', () => {
    const cols = getTableColumns(columnEmbeddings);
    const embeddingCol = cols.embedding as unknown as { getSQLType: () => string };
    expect(embeddingCol.getSQLType()).toBe('FLOAT[1536]');
  });

  it('embedding column is not a plain text or integer column type', () => {
    const cols = getTableColumns(columnEmbeddings);
    expect(cols.embedding.columnType).not.toBe('PgText');
    expect(cols.embedding.columnType).not.toBe('PgInteger');
  });
});

// ---------------------------------------------------------------------------
// AC 6: widgets.columns and widgets.legendLabels are text columns (not JSON)
// ---------------------------------------------------------------------------

describe('Slice 2 AC: widgets.columns and widgets.legendLabels are text columns', () => {
  it('widgets.columns is a PgText column', () => {
    const cols = getTableColumns(widgets);
    expect(cols.columns.columnType).toBe('PgText');
  });

  it('widgets.legendLabels is a PgText column', () => {
    const cols = getTableColumns(widgets);
    expect(cols.legendLabels.columnType).toBe('PgText');
  });

  it('widgets.columns is not a JSON column type', () => {
    const cols = getTableColumns(widgets);
    expect(cols.columns.columnType).not.toBe('PgJson');
    expect(cols.columns.columnType).not.toBe('PgJsonb');
  });

  it('widgets.legendLabels is not a JSON column type', () => {
    const cols = getTableColumns(widgets);
    expect(cols.legendLabels.columnType).not.toBe('PgJson');
    expect(cols.legendLabels.columnType).not.toBe('PgJsonb');
  });
});

// ---------------------------------------------------------------------------
// AC 7: cascade-delete foreign keys on tableId / dashboardId columns
// ---------------------------------------------------------------------------

describe('Slice 2 AC: discoveredColumns.tableId has onDelete cascade', () => {
  it('has a foreign key on table_id', () => {
    const fks = getInlineFKs(discoveredColumns);
    const fk = fks.find((f) => f.reference().columns[0].name === 'table_id');
    expect(fk).toBeDefined();
  });

  it('the table_id foreign key specifies onDelete cascade', () => {
    const fks = getInlineFKs(discoveredColumns);
    const fk = fks.find((f) => f.reference().columns[0].name === 'table_id');
    expect(fk?.onDelete).toBe('cascade');
  });
});

describe('Slice 2 AC: discoveredForeignKeys.tableId has onDelete cascade', () => {
  it('has a foreign key on table_id', () => {
    const fks = getInlineFKs(discoveredForeignKeys);
    const fk = fks.find((f) => f.reference().columns[0].name === 'table_id');
    expect(fk).toBeDefined();
  });

  it('the table_id foreign key specifies onDelete cascade', () => {
    const fks = getInlineFKs(discoveredForeignKeys);
    const fk = fks.find((f) => f.reference().columns[0].name === 'table_id');
    expect(fk?.onDelete).toBe('cascade');
  });
});

describe('Slice 2 AC: discoveredIndexes.tableId has onDelete cascade', () => {
  it('has a foreign key on table_id', () => {
    const fks = getInlineFKs(discoveredIndexes);
    const fk = fks.find((f) => f.reference().columns[0].name === 'table_id');
    expect(fk).toBeDefined();
  });

  it('the table_id foreign key specifies onDelete cascade', () => {
    const fks = getInlineFKs(discoveredIndexes);
    const fk = fks.find((f) => f.reference().columns[0].name === 'table_id');
    expect(fk?.onDelete).toBe('cascade');
  });
});

describe('Slice 2 AC: widgets.dashboardId has onDelete cascade', () => {
  it('has a foreign key on dashboard_id', () => {
    const fks = getInlineFKs(widgets);
    const fk = fks.find((f) => f.reference().columns[0].name === 'dashboard_id');
    expect(fk).toBeDefined();
  });

  it('the dashboard_id foreign key specifies onDelete cascade', () => {
    const fks = getInlineFKs(widgets);
    const fk = fks.find((f) => f.reference().columns[0].name === 'dashboard_id');
    expect(fk?.onDelete).toBe('cascade');
  });
});
