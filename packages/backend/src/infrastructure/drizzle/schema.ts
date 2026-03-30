import { pgTable, text, integer, boolean, timestamp, uniqueIndex, customType } from 'drizzle-orm/pg-core';

const float1536 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'FLOAT[1536]';
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});

export const connectionConfigs = pgTable('connection_configs', {
  id: text('id').primaryKey(),
  host: text('host').notNull(),
  port: integer('port').notNull().default(5432),
  databaseName: text('database_name').notNull(),
  username: text('username').notNull(),
  encryptedPassword: text('encrypted_password').notNull(),
  dbType: text('db_type').notNull().default('postgresql'),
  encrypt: boolean('encrypt'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const discoveredTables = pgTable(
  'discovered_tables',
  {
    id: text('id').primaryKey(),
    connectionId: text('connection_id').notNull().references(() => connectionConfigs.id),
    schemaName: text('schema_name').notNull(),
    tableName: text('table_name').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('discovered_tables_connection_schema_table_unique').on(
      table.connectionId,
      table.schemaName,
      table.tableName,
    ),
  ],
);

export const discoveredColumns = pgTable('discovered_columns', {
  id: text('id').primaryKey(),
  tableId: text('table_id')
    .notNull()
    .references(() => discoveredTables.id, { onDelete: 'cascade' }),
  columnName: text('column_name').notNull(),
  dataType: text('data_type').notNull(),
  isNullable: boolean('is_nullable').notNull(),
  ordinalPosition: integer('ordinal_position').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const discoveredForeignKeys = pgTable('discovered_foreign_keys', {
  id: text('id').primaryKey(),
  tableId: text('table_id')
    .notNull()
    .references(() => discoveredTables.id, { onDelete: 'cascade' }),
  constraintName: text('constraint_name').notNull(),
  columnName: text('column_name').notNull(),
  foreignTableSchema: text('foreign_table_schema').notNull(),
  foreignTableName: text('foreign_table_name').notNull(),
  foreignColumnName: text('foreign_column_name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const discoveredIndexes = pgTable('discovered_indexes', {
  id: text('id').primaryKey(),
  tableId: text('table_id')
    .notNull()
    .references(() => discoveredTables.id, { onDelete: 'cascade' }),
  indexName: text('index_name').notNull(),
  columnName: text('column_name').notNull(),
  isUnique: boolean('is_unique').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const columnEmbeddings = pgTable(
  'column_embeddings',
  {
    id: text('id').primaryKey(),
    connectionId: text('connection_id')
      .notNull()
      .references(() => connectionConfigs.id),
    tableId: text('table_id')
      .notNull()
      .references(() => discoveredTables.id),
    columnId: text('column_id')
      .notNull()
      .references(() => discoveredColumns.id, { onDelete: 'cascade' }),
    inputText: text('input_text').notNull(),
    embedding: float1536('embedding').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('column_embeddings_connection_table_column_unique').on(
      table.connectionId,
      table.tableId,
      table.columnId,
    ),
  ],
);

export const dashboards = pgTable('dashboards', {
  id: text('id').primaryKey(),
  connectionId: text('connection_id')
    .notNull()
    .references(() => connectionConfigs.id),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const widgets = pgTable('widgets', {
  id: text('id').primaryKey(),
  dashboardId: text('dashboard_id')
    .notNull()
    .references(() => dashboards.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  chartType: text('chart_type').notNull(),
  sql: text('sql').notNull(),
  columns: text('columns').notNull(),
  legendLabels: text('legend_labels'),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull(),
});
