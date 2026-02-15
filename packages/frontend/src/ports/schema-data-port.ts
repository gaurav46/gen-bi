import type { DiscoveredTable } from '../domain/schema-types';

export interface SchemaDataPort {
  fetchTables(connectionId: string): Promise<DiscoveredTable[]>;
}
