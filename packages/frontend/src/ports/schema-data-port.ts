import type { DiscoveredTable, TableRowsResponse } from '../domain/schema-types';

export interface SchemaDataPort {
  fetchTables(connectionId: string): Promise<DiscoveredTable[]>;
  fetchTableRows(connectionId: string, schemaName: string, tableName: string, page: number): Promise<TableRowsResponse>;
}
