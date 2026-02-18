import { useCallback, useEffect, useState } from 'react';
import type { SchemaDataPort } from '../ports/schema-data-port';

type TableRef = {
  connectionId: string;
  schemaName: string;
  tableName: string;
} | null;

export function useTableRows(port: SchemaDataPort, table: TableRef) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const tableKey = table ? `${table.connectionId}:${table.schemaName}:${table.tableName}` : null;

  useEffect(() => {
    setPage(1);
  }, [tableKey]);

  useEffect(() => {
    if (!table) return;

    setIsLoading(true);
    setError(null);

    port
      .fetchTableRows(table.connectionId, table.schemaName, table.tableName, page)
      .then((response) => {
        setRows(response.rows);
        setTotalRows(response.totalRows);
        setPageSize(response.pageSize);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [tableKey, page, retryCount]);

  const goToNextPage = useCallback(() => setPage((p) => p + 1), []);
  const goToPreviousPage = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  const retry = useCallback(() => setRetryCount((c) => c + 1), []);

  return { rows, totalRows, page, pageSize, isLoading, error, goToNextPage, goToPreviousPage, retry };
}
