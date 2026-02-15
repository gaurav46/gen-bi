import type { SchemaDataPort } from '../ports/schema-data-port';
import type { DiscoveredTable } from '../domain/schema-types';

export class FetchSchemaDataAdapter implements SchemaDataPort {
  async fetchTables(connectionId: string): Promise<DiscoveredTable[]> {
    const response = await fetch(`/api/schema/${connectionId}/tables`);
    if (!response.ok) {
      throw new Error(`Failed to fetch tables: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
}
