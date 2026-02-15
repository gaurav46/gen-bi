import { useState, useEffect, useMemo } from 'react';
import type { SchemaDataPort } from '../ports/schema-data-port';
import type { DiscoveredTable } from '../domain/schema-types';
import { groupTablesBySchema, filterTablesByName } from '../domain/schema-transforms';

export function useSchemaExplorer(port: SchemaDataPort, connectionId: string | null) {
  const [tables, setTables] = useState<DiscoveredTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTable, setSelectedTable] = useState<DiscoveredTable | null>(null);

  useEffect(() => {
    if (!connectionId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    port.fetchTables(connectionId).then((data) => {
      if (!cancelled) {
        setTables(data);
        setIsLoading(false);
      }
    }).catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : String(err));
        setIsLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [port, connectionId]);

  const filteredTables = useMemo(() => filterTablesByName(tables, searchTerm), [tables, searchTerm]);
  const groupedTables = useMemo(() => groupTablesBySchema(filteredTables), [filteredTables]);

  return {
    tables,
    filteredTables,
    groupedTables,
    isLoading,
    error,
    searchTerm,
    setSearchTerm,
    selectedTable,
    setSelectedTable,
    refetch: () => {
      if (!connectionId) return;
      setIsLoading(true);
      setError(null);
      port.fetchTables(connectionId).then(setTables).catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      }).finally(() => setIsLoading(false));
    },
  };
}
