import type { SchemaDataPort } from '../ports/schema-data-port';
import type { DiscoveredTable, TableRowsResponse } from '../domain/schema-types';

export class FetchSchemaDataAdapter implements SchemaDataPort {
  async fetchTables(connectionId: string): Promise<DiscoveredTable[]> {
    const response = await fetch(`/api/schema/${connectionId}/tables`);
    if (!response.ok) {
      throw new Error(`Failed to fetch tables: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  async fetchTableRows(connectionId: string, schemaName: string, tableName: string, page: number): Promise<TableRowsResponse> {
    const response = await fetch(`/api/schema/${connectionId}/tables/${schemaName}/${tableName}/rows?page=${page}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch rows: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
}
